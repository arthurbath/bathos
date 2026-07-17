# MCP Module Actions Specification

## Purpose

Define authenticated MCP access to BathOS module data while preserving the signed-in user's existing Supabase RLS boundaries.

## Requirements

### Requirement: Authenticated MCP Module Access
The BathOS MCP server SHALL expose module actions only for an OAuth-authenticated BathOS user, and every action SHALL use that user's Supabase bearer token so existing RLS policies remain authoritative.

#### Scenario: Unauthenticated MCP action
- **WHEN** an MCP client calls a module action without a valid BathOS OAuth user token
- **THEN** the action fails without reading or mutating module data

#### Scenario: Authenticated MCP action
- **WHEN** an MCP client calls a module action with a valid BathOS OAuth user token
- **THEN** the action runs as the signed-in BathOS user and returns structured JSON

### Requirement: Garage MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated user to read, create, update, and delete their Garage vehicles, vehicle services, and vehicle servicing records. Garage servicing records SHALL support service outcome rows associated with the servicing, but receipt file upload and download are out of scope for this capability.

#### Scenario: Read Garage resources
- **WHEN** an authenticated MCP client requests Garage vehicles, services, or servicings
- **THEN** the server returns only records owned by the signed-in user

#### Scenario: Mutate Garage resources
- **WHEN** an authenticated MCP client creates, updates, or deletes a Garage vehicle, service, or servicing
- **THEN** the server applies the mutation only within the signed-in user's Garage scope and returns the resulting record or delete confirmation

### Requirement: Snake MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated household member to read, create, update, and delete Snake household snakes and snake weight records. Snake MCP actions SHALL support the user's accessible Snake household and MUST reject records outside that household.

#### Scenario: Read Snake resources
- **WHEN** an authenticated MCP client requests snakes or weight records
- **THEN** the server returns only records from an accessible Snake household

#### Scenario: Mutate Snake resources
- **WHEN** an authenticated MCP client creates, updates, or deletes a snake or weight record
- **THEN** the server applies the mutation only within the resolved Snake household and returns the resulting record or delete confirmation

### Requirement: Budget MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated household member to read, create, update, and delete Budget household expenses, income streams, budgets, categories, and payment methods. Budget MCP actions SHALL also allow updating household partner settings that are editable in the Budget configuration screen.

#### Scenario: Read Budget resources
- **WHEN** an authenticated MCP client requests Budget household data
- **THEN** the server returns only records from an accessible Budget household

#### Scenario: Mutate Budget records
- **WHEN** an authenticated MCP client creates, updates, or deletes a Budget expense, income stream, budget, category, or payment method
- **THEN** the server applies the mutation only within the resolved Budget household and returns the resulting record or delete confirmation

#### Scenario: Update Budget household settings
- **WHEN** an authenticated MCP client updates Budget partner names or wage-gap settings
- **THEN** the server updates only the resolved Budget household and returns the updated household settings

### Requirement: Wardrobe MCP Resource Actions
The BathOS MCP server SHALL allow an authenticated user to read, create, update, and delete their Wardrobe items.

#### Scenario: Read Wardrobe resources
- **WHEN** an authenticated MCP client requests Wardrobe items
- **THEN** the server returns only items owned by the signed-in user

#### Scenario: Mutate Wardrobe items
- **WHEN** an authenticated MCP client creates, updates, or deletes a Wardrobe item
- **THEN** the server applies the mutation only within the signed-in user's Wardrobe scope and returns the resulting item or delete confirmation

### Requirement: MCP Mutation Guardrails
The BathOS MCP server SHALL reject unsupported resources, unsupported operations, invalid owner fields, and missing required identifiers before issuing a database mutation.

#### Scenario: Unsupported resource
- **WHEN** an MCP client requests a resource not declared by the module action schema
- **THEN** the server rejects the request without issuing a database mutation

#### Scenario: Missing mutation identifier
- **WHEN** an MCP client requests an update or delete operation without the target record id
- **THEN** the server rejects the request without issuing a database mutation
