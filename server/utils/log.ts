import dotenv from 'dotenv';
dotenv.config();

import log, { LogLevelDesc } from "loglevel";
log.setLevel( process.env.LOG_LEVEL as LogLevelDesc ?? "info" );
console.log( "log level", log.getLevel() );

export default log;
