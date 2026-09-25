import logging
import sys
import structlog
from app.core.config import settings


def setup_logging() -> None:
    """
    Configures structured logging for production and development.
    Outputs JSON logs in production, and pretty colored console in local dev/debug.
    """
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.DEBUG and settings.APP_ENV != "production":
        # Human-readable colored output during development
        renderer = structlog.dev.ConsoleRenderer()
    else:
        # Machine-readable JSON output in production
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=shared_processors + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(logging.INFO if not settings.DEBUG else logging.DEBUG)

    # Silence noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


logger = structlog.get_logger("eve_healthcare")
