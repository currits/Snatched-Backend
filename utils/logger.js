const { format, createLogger, transports } = require("winston");
const { combine, timestamp, printf } = format;

const cformat = printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

exports.listingLogger = createLogger({
    level: "verbose",
    format: combine(timestamp(), cformat),
    transports: [
        new transports.File({
            filename: "logs/listings.log"
        })
    ]
});

exports.errorLogger = createLogger({
    level: "error",
    format: combine(timestamp(), cformat),
    transports: [
        new transports.File({
            filename: "logs/error.log"
        }),
        new transports.Console()
    ]
});

exports.userLogger = createLogger({
    level: "verbose",
    format: combine(timestamp(), cformat),
    transports: [
        new transports.File({
            filename: "logs/user.log"
        }),
        new transports.Console()
    ]
});