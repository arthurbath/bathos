# Development Toolchain Security

## Purpose

Define the supported, security-patched build-toolchain and development-server exposure contract for BathOS.

## Requirements

### Requirement: Supported root build toolchain
The BathOS root application SHALL resolve its development and production build commands through one supported security-patched Vite release that is compatible with the repository's Node runtime and installed Vite peer packages.

#### Scenario: Install the root dependency graph
- **WHEN** the root lockfile is installed and the Vite dependency graph is inspected
- **THEN** exactly one valid supported Vite node serves the root build, test, React SWC, Lovable tagging, and MCP tooling peers
- **AND** no unsupported or advisory-affected Vite major remains in that root graph

#### Scenario: Build development and production output
- **WHEN** the repository creates development and production builds
- **THEN** React SWC compilation, module aliases, workers, PowerSync, WA-SQLite, PWA assets, and registered application routes remain available without a Vite error

### Requirement: Development server exposure is explicit
Ordinary BathOS development SHALL listen only on the local machine, while network-accessible device testing SHALL require a separately named explicit command.

#### Scenario: Start ordinary development
- **WHEN** a developer runs the ordinary development command
- **THEN** Vite listens on a loopback address and does not bind every available network interface

#### Scenario: Start intentional LAN testing
- **WHEN** a developer runs the explicit LAN development command
- **THEN** Vite listens on an all-interface address and clearly reports the network URLs used for device testing

### Requirement: Development integrations survive the toolchain update
The supported toolchain SHALL preserve BathOS development diagnostics and generated integration behavior without changing production product semantics.

#### Scenario: Use development-only integrations
- **WHEN** the development server starts and a source change is loaded
- **THEN** HMR, client-console mirroring, development-only Lovable component tagging, and MCP generation remain operational

#### Scenario: Run production output
- **WHEN** BathOS is built or previewed in production mode
- **THEN** development-only tagging and local diagnostic endpoints are not added to production behavior
