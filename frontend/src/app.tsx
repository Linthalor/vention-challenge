import React, { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import './app.scss';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSocket, useSocketEvent } from 'socket.io-react-hook';
import { PositionMessage } from '../../common/messages/possition-message';
import { acos, cross, distance, dot, number, /*add, rotate*/ } from 'mathjs';
import { getRadius } from '../../common/util';
import { PendulumConfig } from '../../common/pendulum-config';
import { Box, Button, Checkbox, FormControlLabel, Slider, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import { theme } from './app/theme';
import { Cloud, Speed, SyncAlt } from '@mui/icons-material';
import { SimulationState, SimulationStateMessage } from '../../common/messages/simulation-state-message';
import { PositionRateMessage } from '../../common/messages/position-rate-message';
import { MessageTypes } from '../../common/messages/message-types';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { PendulumConfigFormSchema, winSettings } from './model/pendulum-config-schema';

const apiUrl = (port: number) => `http://localhost:${port}/`;

// TODO: FIXME: put this in a better place
const scale = 16;
// TODO: FIXME: needs to have this read from the config yml
const pendulums = [3001, 3002, 3003, 3004, 3005];
// TODO: FIXME: needs to have this read from the config yml
const spacing = 5;
// TODO: FIXME: needs to have this read from the config yml
const simulationPollSpeedMs = 200;

// TODO: have this get randomly generated?
// const startConfig = {
//   theta: 15 * (Math.PI/180),
//   length: 1,
//   mass: 1,
//   damping: 0.2,
//   maxWind: -3,
//   windFreq: 1/10,
// }
const initialConfig = [{
  theta: 45 * (Math.PI/180),
  length: 4,
  mass: 1,
  damping: 0.2,
  maxWind: 1,
  windFreq: 1/10,
  stopAndRestartOnCollision: false,
}, {
  theta: -45 * (Math.PI/180),
  length: 4,
  mass: 1,
  damping: 0.2,
  maxWind: 1,
  windFreq: 1/10,
  stopAndRestartOnCollision: false,
}, {
  theta: -60 * (Math.PI/180),
  length: 5,
  mass: 1,
  damping: 0.2,
  maxWind: 1,
  windFreq: 1/10,
  stopAndRestartOnCollision: false,
}, {
  theta: -18 * (Math.PI/180),
  length: 8,
  mass: .001,
  damping: 0.2,
  maxWind: 1,
  windFreq: 1/10,
  stopAndRestartOnCollision: false,
}, {
  theta: -70 * (Math.PI/180),
  length: 4,
  mass: 10,
  damping: 0.2,
  maxWind: 1,
  windFreq: 1/10,
  stopAndRestartOnCollision: false,
}];

// const drawLine = (
//   line: { x: number, y: number, x1: number, y1: number},
//   ctx: CanvasRenderingContext2D,
//   style: { color?: string, width?: number } = {},
// ) => {
//   const { x, y, x1, y1 } = line;
//   const { color = 'black', width = 1 } = style;

//   ctx.beginPath();
//   ctx.moveTo(x, y);
//   ctx.lineTo(x1, y1);
//   ctx.strokeStyle = color;
//   ctx.lineWidth = width;
//   ctx.stroke();
// }

// const drawCircle = (
//   pos: { x: number, y: number },
//   radius: number,
//   ctx: CanvasRenderingContext2D,
//   style: { color?: string, fillColor?: string, width?: number } = {},
// ) => {
//   const { color = 'black', fillColor = 'black', width = 1 } = style;

//   ctx.beginPath();
//   ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI, false);
//   ctx.fillStyle = fillColor;
//   ctx.fill();
//   ctx.lineWidth = width;
//   ctx.strokeStyle = color;
//   ctx.stroke();
// }

const ValueLabelComponent = (props: {
  children: React.ReactElement;
  value: number;
}) => {
  const { children, value } = props;

  return (
    <Tooltip enterTouchDelay={0} placement="right" title={value}>
      {children}
    </Tooltip>
  );
}

const App = () => {
  // const canvas = useRef<HTMLCanvasElement>(null);
  // const ctx = useMemo(() => {
  //   const canvasEle = canvas.current;
  //   if (canvasEle) {
  //     canvasEle.width = canvasEle.clientWidth;
  //     canvasEle.height = canvasEle.clientHeight;
  
  //     // get context of the canvas
  //     return canvasEle.getContext("2d");
  //   }
  // }, [canvas.current]);
  const { t } = useTranslation();

  // TODO: have it randomly generate 5 configs each page load?
  const [configs, setConfigs] = useState<PendulumConfig[]>(initialConfig);

  const { handleSubmit, register, formState, control, watch, getValues } = useForm({
    resolver: zodResolver(PendulumConfigFormSchema),
    mode: 'onBlur',
    defaultValues: {
      windMagnitude: 1.0,
      windFrequency: 0.1,
      restartOnCollision: true,
      useInterpolation: true,
    },
  });

  const start = () => {
    const formConfig = getValues();
    setConfigs(prevConfigs => prevConfigs.map((config, idx) => {
      const newConfig: PendulumConfig = {
        ...config,
        maxWind: formConfig.windMagnitude,
        windFreq: formConfig.windFrequency,
        stopAndRestartOnCollision: formConfig.restartOnCollision,
      };
      fetch(`${apiUrl(pendulums[idx])}start`, {
        method: 'POST',
        body: JSON.stringify(newConfig),
        headers: {
          'Content-Type': 'application/json'
        },
      });
      return newConfig;
    }));
  };
  
  const continueSim = () => {
    pendulums.forEach(port => fetch(`${apiUrl(port)}continue`));
  };
  
  const pause = () => {
    pendulums.forEach(port => fetch(`${apiUrl(port)}pause`));
  };
  
  const stop = () => {
    pendulums.forEach(port => fetch(`${apiUrl(port)}stop`));
  };

  const center = useMemo(() => Math.floor(pendulums.length / 2), [pendulums]);

  const svg = useRef<SVGSVGElement>(null);
  // pendulums won't change so it is safe to use hooks inside the map.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const pendulumBases = pendulums.map(() => useRef<SVGCircleElement>(null));

  // pendulums won't change so it is safe to use hooks inside the map.
  const messages = pendulums.map(pendulum => {
    const url = apiUrl(pendulum);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { socket, error } = useSocket(url);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { lastMessage: position, sendMessage } = useSocketEvent<PositionMessage | undefined>(socket, MessageTypes.Position);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { lastMessage: messageRate } = useSocketEvent<PositionRateMessage | undefined>(socket, MessageTypes.PositionRate);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { lastMessage: simulationState } = useSocketEvent<SimulationStateMessage | undefined>(socket, MessageTypes.SimulationState);
    return {
      url,
      position,
      messageRate,
      simulationState,
    };
  });
  const messageWatcher = [...messages.map(m => m.position?.theta)];

  const simulationState = messages.reduce((prev, curr) => {
    if (curr.simulationState?.state === SimulationState.Started || curr.simulationState?.state === SimulationState.Restarting) {
      return SimulationState.Started;
    } else if (prev !== SimulationState.Started && curr.simulationState?.state === SimulationState.Paused) {
      return SimulationState.Paused;
    } else if (prev !== SimulationState.Started && prev !== SimulationState.Paused && curr.simulationState?.state === SimulationState.Stopped) {
      return SimulationState.Stopped;
    }
    return prev;
  }, SimulationState.Stopped);
  
  // useEffect(() => {
  //   messages.forEach(({ url, lastMessage }) => {
  //     if (lastMessage) {
  //       console.log(
  //         url, ' --- ',
  //         'angle', lastMessage.theta * (180/Math.PI),
  //         ' --- length ', lastMessage.length,
  //         ' --- wind ', lastMessage.wind
  //       );        
  //     }
  //   })
  // }, messageWatcher);

  // useEffect(() => {
  //   if (ctx && canvas.current) {
  //     ctx.clearRect(0, 0, canvas.current.width, canvas.current.height);
  //     ctx.translate(canvas.current.width/2,canvas.current.height/2);
  //     ctx.scale(10, 10);
  //     drawLine({ x: -canvas.current.width/2, y: 0, x1: canvas.current.width/2, y1: 0 }, ctx, { color: 'green', width: 0.5 });
  //     drawLine({ x: 0, y: -canvas.current.height/2, x1: 0, y1: canvas.current.height/2 }, ctx, { color: 'green', width: 0.5 });

  //     messages.forEach(({ lastMessage }, idx) => {
  //       if (lastMessage) {
  //         const positionOffset = idx * spacing;
  //         const x = positionOffset;
  //         const y = 0;
  //         const [x1, y1] = add(rotate([0, lastMessage.length], lastMessage.theta), [x, 0]);

  //         drawLine({ x, y, x1, y1 }, ctx, { color: idx === 1 ? 'red' : 'blac k', width: 1/10 });
  //         const volume = lastMessage.mass; // Assuming a density of 1 for (V = m/p)
  //         const radius = getRadius(volume);
  //         drawCircle({ x: x1, y: y1 }, radius, ctx, { width: 1/10 });
  //       }
  //     });
  //     ctx.scale(1/10, 1/10);
  //     ctx.translate(-canvas.current.width/2, -canvas.current.height/2);
  //   }
  // }, messageWatcher);

  const {
    viewSize,
    halfViewSize,
    smallGridSize,
    bigGridSize,
    pendulumPivotLineOffsetY,
    simpleStrokeWidth,
  } = useMemo(() => {
    const viewSize = spacing * 200;
    const halfViewSize = viewSize / 2;
    const smallGridSize = spacing / scale;
    const bigGridSize = smallGridSize * 10;
    const pendulumPivotLineOffsetY = bigGridSize * 4;
    const simpleStrokeWidth = 1 / scale;
    return {
      viewSize,
      halfViewSize,
      smallGridSize,
      bigGridSize,
      pendulumPivotLineOffsetY,
      simpleStrokeWidth
    };
  }, []);

  const averageWindSpeed = useMemo(() =>
    messages.reduce(
      (total, msg) => total += msg.position ? msg.position.wind : 0,
      0
    ) / messages.length,
    // messageWatcher checks messages
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messageWatcher]
  );

  const [dragging, setDragging] = useState(false);
// TODO: use the useCallback hook for all my callbacks?
  const startPendulumDrag = useCallback((
    event: React.MouseEvent<SVGCircleElement>,
    idx: number,
    origin: { x: number, y: number},
    baseRef: React.RefObject<SVGCircleElement>,
  ) => {
    if (simulationState !== SimulationState.Stopped || !baseRef.current || !svg.current) return;
    event.preventDefault();

    setDragging(true);

    // TODO: get pendulum rotation point and then 
    
    const point = svg.current.createSVGPoint();
    const mousemove = (event: MouseEvent) => {
      if (baseRef.current && svg.current) {
        event.preventDefault();
        point.x = event.clientX;
        point.y = event.clientY;
        const box = baseRef.current.getBoundingClientRect();
        const pivotCenter = {
          x: (box.left + box.right) / 2,
          y: (box.top + box.bottom) / 2,
        };
        const dimensions = [
          (point.x - pivotCenter.x) / scale,
          (point.y - pivotCenter.y) / scale,
        ];

        const length =  number(distance([0, 0], dimensions));
        const theta = acos(dot([0, 1], dimensions) / length);

        setConfigs(prevConfigs => {
          prevConfigs[idx] = {
            ...prevConfigs[idx],
            length,
            theta: theta * (-dimensions[0] < 0 ? -1 : 1),
          };

          return prevConfigs;
        })
      }
    };

    document.addEventListener(
      'mouseup',
      () => {
        document.removeEventListener('mousemove', mousemove);
        setDragging(false);
      },
      { once: true }
    );
    document.addEventListener("mousemove", mousemove);
  }, [simulationState]);

  return (
    <Box
      className="app"
      sx={{
        pl: 2,
        py: 2,
        background: theme.palette.background.paper,
        gap: 1,
        alignItems: 'stretch',
      }}
    >
      <Toolbar
        sx={{
          gap: 1,
          background: theme.palette.primary.main,
          color: theme.palette.primary.contrastText,
          borderBottomLeftRadius: 32,
          borderTopLeftRadius: 32,
          position: 'relative',
        }}
        className="action-toolbar"
      >
        <>
          {/* {simulationState === SimulationState.Stopped && <Box className="actions" sx={{ gap: 1 }}> */}
          <Button color="inherit" onClick={() => start()}>
            {simulationState === SimulationState.Stopped ? t('common:start') : t('common:restart')}
          </Button>
          {simulationState === SimulationState.Started && <>
            <Button color="inherit" onClick={() => pause()}>{t('common:pause')}</Button>
          </>}
          {simulationState === SimulationState.Paused && <>
            <Button color="inherit" onClick={() => continueSim()}>{t('common:continue')}</Button>
          </>}
          {(simulationState === SimulationState.Started || simulationState === SimulationState.Paused) && <>
            <Button color="inherit" onClick={() => stop()}>{t('common:stop')}</Button>
          </>}
          <div style={{ flex: 1}} />
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Cloud sx={{ fontSize: 60 }} color="inherit" />
            {simulationState === SimulationState.Started && <Typography
              color="primary"
              variant="caption"
              sx={{
                position: 'absolute',
                textAlign: 'center',
                fontSize: 10,
                bottom: 16,
              }}>
{/* TODO: use the i18n library to do this. */}
              {(Math.round(averageWindSpeed * -100) / 100).toFixed(2)}Nm
            </Typography>}
          </Box>
          <Box
            className="actions"
            sx={{
              gap: 1,
              width: simulationState === SimulationState.Stopped ? 400 : 0
            }}
          >
            <Stack spacing={0} direction="column" alignItems="stretch" style={{ width: 200 }}>
              <Tooltip title={t('pendulum:wind:magnitude')} placement="left">
                <Stack spacing={2} direction="row" alignItems="center">
                  <Speed />
                  <Controller
                    name="windMagnitude"
                    control={control}
                    // defaultValue={10 /*getValues().windMagnitude*/}
                    render={({ formState, fieldState, ...props }) => (
                      <Slider
                        {...props}
                        value={props.field.value}
                        onChange={(_, value) => {
                          props.field.onChange(value);
                        }}
                        color="secondary"
                        size="small"
                        // placement="bottom"
                        valueLabelDisplay="auto"
                        aria-label={t('pendulum:wind:magnitude')}
                        min={winSettings.frequency.min}
                        max={winSettings.frequency.max}
                        step={winSettings.frequency.step}
                        disabled={simulationState !== SimulationState.Stopped}
                        components={{
                          ValueLabel: ValueLabelComponent,
                        }}
                      />
                    )}
                  />
                </Stack>
              </Tooltip>
              <Tooltip title={t('pendulum:wind:frequency')} placement="left">
                <Stack spacing={2} direction="row" alignItems="center">
                  <SyncAlt />
                  <Controller
                    name="windFrequency"
                    control={control}
                    // defaultValue={getValues().windFrequency}
                    render={({ formState, fieldState, ...props }) => (
                      <Slider
                        {...props}
                        value={props.field.value}
                        onChange={(_, value) => {
                          props.field.onChange(value);
                        }}
                        color="secondary"
                        size="small"
                        // placement="bottom"
                        valueLabelDisplay="auto"
                        aria-label={t('pendulum:wind:frequency')}
                        min={winSettings.frequency.min}
                        max={winSettings.frequency.max}
                        step={winSettings.frequency.step}
                        disabled={simulationState !== SimulationState.Stopped}
                        components={{
                          ValueLabel: ValueLabelComponent,
                        }}
                      />
                    )}
                  />
                </Stack>
              </Tooltip>
            </Stack>
            <Stack spacing={0} direction="column" alignItems="start">
              <FormControlLabel
                sx={{ ml: 1, height: 28 }}
                control={
                  <Checkbox
                    color="secondary"
                    disabled={simulationState !== SimulationState.Stopped}
                    {...register('restartOnCollision')}
                    checked={watch('restartOnCollision')}
                  />
                }
                label={
                  <Typography variant='caption'>{t('pendulum:restartOnCollision')}</Typography>
                }
              />
              <FormControlLabel
                sx={{ ml: 1, height: 28 }}
                control={
                  <Checkbox
                    color="secondary"
                    disabled={simulationState !== SimulationState.Stopped}
                    {...register('useInterpolation')}
                    checked={watch('useInterpolation')}
                  />
                }
                label={
                  <Typography variant='caption'>{t('pendulum:useInterpolation')}</Typography>
                }
              />
            </Stack>
          </Box>
        </>
      </Toolbar>
      {/* <canvas
        ref={canvas}
        style={{ width: '100%', flex: 1, }}
      /> */}
      <Box sx={{ flex: 1, mr: 1, position: 'relative', overflow: 'hidden' }}>
        <svg
          ref={svg}
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: '100%',
            height: '100%'
          }}
          viewBox={`0 0 ${viewSize} ${viewSize}`}
          preserveAspectRatio="xMidYMin"
        >
          <defs>
            <pattern id="smallGrid" width={smallGridSize} height={smallGridSize} patternUnits="userSpaceOnUse">
              <path
                d={`M ${smallGridSize} 0 L 0 0 0 ${smallGridSize}`}
                fill="none"
                stroke={theme.palette.primary.main}
                strokeWidth={0.5 / scale}
              />
            </pattern>
            <pattern id="grid" width={bigGridSize} height={bigGridSize} patternUnits="userSpaceOnUse">
              <rect width={bigGridSize} height={bigGridSize} fill="url(#smallGrid)"/>
              <path
                d={`M ${bigGridSize} 0 L 0 0 0 ${bigGridSize}`}
                fill="none"
                stroke={theme.palette.primary.main}
                strokeWidth={simpleStrokeWidth}
              />
            </pattern>
          </defs>

          <g transform={`scale(${scale})`}
            transform-origin={`${halfViewSize} 0`}
          >
            <rect
              className="grid"
              width="100%"
              height="100%"
              fill="url(#grid)"
              stroke={theme.palette.primary.main}
              strokeWidth={simpleStrokeWidth}
            />
            <rect
              className="pendulum-line"
              width="100%"
              height={8 / scale}
              y={pendulumPivotLineOffsetY - 4 / scale}
              fill={theme.palette.primary.main}
            />

            <g transform={`translate(${halfViewSize} ${pendulumPivotLineOffsetY})`}>
              {pendulums.map((p, idx) => {
                // TODO: check if we are running (started/paused) (if so read last message, if not read config).
                const position = simulationState !== SimulationState.Stopped
                  ? messages[idx].position
                  : configs[idx];
                if (!position) return <Fragment key={p}></Fragment>;

                const expectedMessageRate = messages[idx].messageRate;
                const transitionTime = expectedMessageRate ? expectedMessageRate.rate : simulationPollSpeedMs;

                const origin = {
                  x: spacing * (idx - center),
                  y: 0,
                };
                const volume = position.mass; // Assuming a density of 1 for (V = m/p)
                const radius = getRadius(volume);
                return <Fragment key={p}>
                  <g
                    className="pendulum"
                    style={{
                      /*
                        Could use a PID controller and track actual message rate to try to
                        adjust to any time dilation issues from too fast a polling config.
                      */
                      transition: simulationState !== SimulationState.Stopped && getValues().useInterpolation
                        ? `all ${transitionTime}ms linear`
                        : undefined,
                      transformOrigin: `${origin.x}px ${origin.y}px`,
                      transform: `rotate(${position.theta}rad)`
                    }}
                  >
                    <circle
                      cx={origin.x}
                      cy={origin.y}
                      r={8 / scale}
                      fill={theme.palette.primary.main}
                      ref={pendulumBases[idx]}
                    />
                    <line
                      x1={origin.x}
                      y1={origin.y}
                      x2={origin.x}
                      y2={origin.y + position.length}
                      stroke={theme.palette.secondary.main}
                      strokeWidth={simpleStrokeWidth * 2}
                    />
                    <circle
                      cx={origin.x}
                      cy={origin.y + position.length}
                      r={radius}
                      fill={theme.palette.secondary.main}
                      style={{
                        padding: 20,
                        cursor: (simulationState === SimulationState.Stopped && (dragging ? 'grabbing' : 'grab')) || '' 
                      }}
                      onMouseDown={(event: React.MouseEvent<SVGCircleElement>) => {
                        startPendulumDrag(event, idx, origin, pendulumBases[idx]);
                      }}
                      // To create handles for dragging when there is a small radius
                      stroke="transparent"
                      strokeWidth={2}
                    />
                  </g>
                </Fragment>;
              })}
            </g>
          </g>
        </svg>
      </Box>
    </Box>
  );
}

export default App;
