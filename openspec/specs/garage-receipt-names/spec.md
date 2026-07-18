# Garage Receipt Names Specification

## Purpose

Define the Garage module behavior for assigning, editing, persisting, and displaying user-facing servicing receipt names while preserving the original uploaded files.

## Requirements

### Requirement: Receipt Name Defaults

The Garage module SHALL assign each newly uploaded servicing receipt a non-empty user-facing name derived from the uploaded filename by removing its final filename extension. A filename without a removable extension SHALL remain unchanged.

#### Scenario: Upload a receipt with an extension

- **WHEN** a user selects a file named `March service invoice.pdf`
- **THEN** the receipt name defaults to `March service invoice`

#### Scenario: Upload a receipt without an extension

- **WHEN** a user selects a file named `March service invoice`
- **THEN** the receipt name defaults to `March service invoice`

### Requirement: Receipt Names Are Editable

The Garage module SHALL allow a user to edit the name associated with a newly selected or previously uploaded servicing receipt without changing the original filename or stored file object.

#### Scenario: Rename a newly selected receipt

- **WHEN** a user changes a pending receipt name before saving a servicing
- **THEN** the receipt is persisted with the edited name and its original uploaded filename remains unchanged

#### Scenario: Rename an uploaded receipt

- **WHEN** a user edits the name of an existing receipt and saves the servicing
- **THEN** the updated receipt name is persisted without replacing or moving the stored file

### Requirement: Servicings Lists Receipt Names

The Garage Servicings grid SHALL display the receipt names associated with each servicing as a comma-delimited list in receipt creation order instead of displaying only a receipt count.

#### Scenario: Servicing has multiple receipts

- **WHEN** a servicing has receipts named `Inspection`, `Parts`, and `Payment`
- **THEN** the Receipts column displays `Inspection, Parts, Payment`

#### Scenario: Servicing has no receipts

- **WHEN** a servicing has no receipts
- **THEN** the Receipts column is empty
