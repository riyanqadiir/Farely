# Farely Admin API Contracts (v1)

This document freezes the initial admin dashboard API contracts and DTO shapes.
It is intentionally strict so the upcoming admin backend can be built against a
stable interface.

## Base

- Base URL: `/admin`
- Auth: `Authorization: Bearer <admin_access_token>`
- Content type: `application/json`
- Time format: ISO 8601 UTC
- Pagination: cursor-based where listed

## Common envelopes

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message"
  }
}
```

## Auth endpoints

### POST `/admin/auth/login`

Request:

```json
{
  "email": "admin@farely.app",
  "password": "string",
  "rememberMe": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "jwt",
    "refreshToken": "jwt",
    "expiresInSec": 900,
    "admin": {
      "id": "adm_123",
      "email": "admin@farely.app",
      "fullName": "Ops Admin",
      "role": "super_admin"
    }
  }
}
```

### POST `/admin/auth/refresh`

Request:

```json
{
  "refreshToken": "jwt"
}
```

Response shape matches login.

### POST `/admin/auth/logout`

Request:

```json
{
  "refreshToken": "jwt"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

## Metrics endpoints

### GET `/admin/metrics/traffic?from=&to=&provider=&city=&rideType=`

Response:

```json
{
  "success": true,
  "data": {
    "summary": {
      "searches": 1420,
      "handoffAttempts": 1102,
      "handoffSuccess": 1068,
      "confirmedRides": 704
    },
    "timeseries": [
      {
        "bucket": "2026-04-24",
        "searches": 130,
        "handoffAttempts": 99,
        "handoffSuccess": 95,
        "confirmedRides": 64
      }
    ],
    "providerBreakdown": [
      {
        "provider": "Uber",
        "searches": 560,
        "handoffAttempts": 430,
        "confirmedRides": 301,
        "conversionRate": 0.538
      }
    ]
  }
}
```

### GET `/admin/metrics/hotspots?from=&to=&city=&zoom=`

Response:

```json
{
  "success": true,
  "data": {
    "tiles": [
      {
        "tileKey": "9q8yy",
        "city": "Lahore",
        "center": { "lat": 31.5204, "lng": 74.3587 },
        "demandCount": 91,
        "confirmedRides": 52,
        "avgEtaMin": 6.2,
        "successRate": 0.571
      }
    ]
  }
}
```

## Ride logs endpoints

### GET `/admin/rides/logs?cursor=&limit=&provider=&status=&q=`

- `status`: `handoff_opened | ride_confirmed | ride_not_taken | handoff_failed`
- `q`: free-text search against pickup/destination

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "rh_1",
        "userId": "usr_1",
        "provider": "Yango",
        "rideType": "car",
        "carAc": false,
        "pickup": "Service Rd",
        "destination": "Main Boulevard",
        "pickupCoords": { "latitude": 31.5, "longitude": 74.3 },
        "destinationCoords": { "latitude": 31.49, "longitude": 74.31 },
        "estimatedFare": 220,
        "status": "ride_confirmed",
        "redirectSucceeded": true,
        "createdAt": "2026-04-24T11:12:34.000Z",
        "userConfirmedAt": "2026-04-24T11:17:12.000Z"
      }
    ],
    "nextCursor": "opaque_cursor_or_null"
  }
}
```

## Support endpoints

### GET `/admin/support/threads?cursor=&limit=&status=&priority=&assigneeId=&q=`

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "th_1",
        "subject": "Driver did not arrive",
        "status": "open",
        "priority": "high",
        "source": "in_app",
        "customer": {
          "userId": "usr_1",
          "name": "Rayan",
          "email": "rayan@example.com"
        },
        "assignee": {
          "adminId": "adm_2",
          "name": "Support Agent"
        },
        "lastMessageAt": "2026-04-24T10:55:00.000Z",
        "createdAt": "2026-04-24T10:21:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

### GET `/admin/support/threads/:id/messages`

Response:

```json
{
  "success": true,
  "data": {
    "thread": {
      "id": "th_1",
      "subject": "Driver did not arrive",
      "status": "open",
      "priority": "high"
    },
    "messages": [
      {
        "id": "msg_1",
        "direction": "inbound",
        "channel": "email",
        "text": "My driver canceled at the last minute.",
        "html": null,
        "createdAt": "2026-04-24T10:22:00.000Z",
        "brevoMessageId": "abc-123"
      }
    ]
  }
}
```

### POST `/admin/support/threads/:id/reply`

Request:

```json
{
  "text": "Sorry for the inconvenience. We are investigating this now.",
  "cc": ["ops@farely.app"]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "sent": true,
    "messageId": "msg_2",
    "brevoMessageId": "def-456"
  }
}
```

### PATCH `/admin/support/threads/:id`

Request:

```json
{
  "status": "in_progress",
  "priority": "medium",
  "assigneeAdminId": "adm_2",
  "internalNote": "Awaiting provider screenshot."
}
```

Response:

```json
{
  "success": true,
  "data": {
    "updated": true,
    "threadId": "th_1"
  }
}
```

## Brevo integration webhooks

### POST `/webhooks/brevo/inbound`

- Verifies Brevo signature.
- Creates/updates support thread and message in admin read model.

### POST `/webhooks/brevo/events`

- Delivery, bounce, opened, clicked, replied metadata updates.
- Upserts message delivery timeline.

## DTO enum definitions

- `AdminRole`: `super_admin | support | ops_analyst`
- `ThreadStatus`: `open | in_progress | resolved | closed`
- `ThreadPriority`: `low | medium | high | urgent`
- `MessageDirection`: `inbound | outbound`
- `RideStatus`: `handoff_opened | handoff_failed | ride_confirmed | ride_not_taken`
