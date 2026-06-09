"""Canonical constants for Brazil spatial coverage.

All adapters import from here so bbox definitions stay consistent.
Coordinates: west, south, east, north (decimal degrees, WGS-84).
Brazil mainland: -73.99W to -34.79W / -33.75S to 5.27N
We add small margins (0.5°) to capture border events and coastal phenomena.
"""

BR_WEST  = -74.5
BR_SOUTH = -34.0
BR_EAST  = -28.0   # includes Fernando de Noronha (-32.4°W)
BR_NORTH =  5.5    # actual north tip: 5.27°N (Oiapoque)

# Comma-separated strings for different API conventions
BR_BBOX_W_S_E_N = f"{BR_WEST},{BR_SOUTH},{BR_EAST},{BR_NORTH}"   # most APIs
BR_BBOX_W_N_E_S = f"{BR_WEST},{BR_NORTH},{BR_EAST},{BR_SOUTH}"   # legacy EONET v2


def in_brazil(lat: float | None, lon: float | None) -> bool:
    """Return True if the point is within the Brazil bounding box."""
    if lat is None or lon is None:
        return False
    return BR_SOUTH <= lat <= BR_NORTH and BR_WEST <= lon <= BR_EAST
