# Colima Space Management

## Decision

Keep Colima's virtual disk on the Mac's internal APFS storage, increase its sparse logical ceiling from 20 GiB to 30 GiB, and control physical growth with automatic cleanup and Docker log rotation. Do not host the live Colima VM on the `Media` SD card.

## Evidence

- The 20 GiB Colima container disk reached 100% utilization while Docker reported 20.34 GB of images and only 314.7 MB of volumes.
- Unused-image cleanup, a controlled resize, and filesystem trimming left the 30 GiB VM disk at 39% utilization with 18 GiB free. Its sparse host file has a 30 GiB logical size but occupies 11 GiB physically.
- The final active BathOS stack uses 11 images totaling 11.18 GB. Docker reports no reclaimable image data. All seven local volumes were preserved and total 406.5 MB.
- The internal APFS sparse disk returned about 9 GiB to the host after `fstrim`, so a 30 GiB logical ceiling does not reserve 30 GiB of physical internal storage.
- `Media` is a removable 512 GB Class 10 SDXC card formatted as Journaled HFS+. It does not expose SMART health data.
- A synced 512 MiB sequential write to `Media` sustained 14.8 MB/s and took 36.35 seconds. The same bounded write to internal storage completed in about one second. PostgreSQL WAL and container storage also depend heavily on random I/O, for which this SD card is expected to perform worse than its sequential result.
- Removing or losing the card while Colima is active would make the VM disk disappear and could corrupt Docker or PostgreSQL state.

## Enforced Policy

1. Colima's container disk has a 30 GiB sparse logical ceiling on internal storage.
2. Docker uses the `local` logging driver with 10 MB files and at most three files per newly created container.
3. `garden.bath.colima-space-maintenance` checks the VM every six hours and at login.
4. Dangling images and build cache older than seven days are always eligible for cleanup.
5. At 65% disk utilization, unused images older than seven days, stopped containers older than 30 days, and unused networks older than seven days are removed.
6. At 80% utilization, every unused image and all build cache are removed.
7. Docker volumes are never removed automatically. This preserves local PostgreSQL databases and other stateful development data.
8. The VM filesystem is trimmed after cleanup so internal APFS can reclaim sparse-file blocks.
9. If utilization remains at or above 80% after safe cleanup, the job logs a warning and presents a macOS notification instead of deleting volumes.
10. A manual `force` run removes every image and build-cache entry not used by a container, but still never removes volumes.

## Operational Notes

The job deliberately prefers re-downloading an unused image over retaining enough old image generations to block PostgreSQL. Images referenced by running or stopped containers remain protected by Docker until the hard-limit procedure removes sufficiently old stopped containers. The SD card remains suitable for exported backups or archives that are not used as a live VM disk.

BathOS was restored as the active local Supabase stack after the cleanup, with its database and ten supporting services running and healthy where health checks are defined. Every recreated container uses the bounded `local` logging configuration. The optional Vector log collector remains excluded because mounting Colima's Docker socket into that container fails independently of disk capacity.

This is a local development-infrastructure policy. It does not affect deployed applications, and it has no OpenSpec behavior impact.
