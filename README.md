REST API:
 - ports can be found in common/config/conf.yml
 - REST API (can be found in backend/src/app.controller.ts):
   - http://localhost:$PORT/start
   - http://localhost:$PORT/continue
   - http://localhost:$PORT/pause
   - http://localhost:$PORT/stop
 - websocket API (can be found in backend/src/pendulum.gateway.ts)
   - connect with socket.io at http://localhost:$PORT/
   - events:
     - position-rate (expected rate of position messages to be sent to the receiving end)
     - position (the simulation's current state (angle, rod length, wind, etc.))
     - simulation-state (the current state of pendulum I.E. stopped, running, paused, restarting, etc.)
