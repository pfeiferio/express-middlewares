# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.11.0] - 2026-03-13

### Changed

- Updated `@pfeiferio/express-csrf` dependency from `1.2.0` to `1.3.0`

## [1.10.0] - 2026-03-13

### Changed

- Updated `@pfeiferio/express-csrf` dependency from `1.1.0` to `1.2.0`

## [1.9.0] - 2026-03-09

### Added

- `shutdownRegistry` option to `applyMiddlewares` for better integration with `request-drain`
- Support for using `gracefulShutdown` with either a `signal` or a `shutdownRegistry`

### Changed

- Updated `prepareOptions` validation to require at least one shutdown mechanism (`signal` or `shutdownRegistry`)

## [1.8.0] - 2026-03-09

### Added

- `shutdownRegistry` option to `gracefulShutdownMiddleware` for coordinated shutdown across multiple middleware instances via `request-drain`
- `signal` is now optional when `shutdownRegistry` is provided

### Fixed

- `gracefulShutdownMiddleware` now listens to `req` close events instead of `res` close events

## [1.7.0] - 2026-03-03

### Added

- `fullUrlMiddleware` to attach the full reconstructed URL to the request object
- `includeRequestId` and `includeCorrelationId` options to `accessLogMiddleware` for including tracing IDs in access logs
- `requestIdMiddleware` with chain propagation, correlationId support, and security validation
- `applyMiddlewares` as a unified middleware setup helper with `prepareOptions`
- Integration of CSRF and cookie-parser into `applyMiddlewares`

### Changed

- Renamed `bodyParser` export to `bodyParserMiddleware` for consistent naming

### Fixed

- Missing export of graceful-shutdown middleware and types

## [1.6.0] - 2026-02-28

### Added

- `gracefulShutdownMiddleware` and `createShutdownSignal` helper for SIGINT/SIGTERM handling

## [1.5.0] - 2026-02-27

### Added

- `bodyParserMiddleware` with support for JSON, URL-encoded, multipart, and raw body parsing

### Changed

- Replaced badge.fury.io with shields.io for npm version badge in README
