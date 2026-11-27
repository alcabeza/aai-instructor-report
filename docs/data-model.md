# Data model

The content script builds one JSON object. It is stored in `chrome.storage.local` under the key `aaiData` (only the latest report is kept) and is what **Export data (JSON)** downloads.

```jsonc
{
  "version": 1,
  "scrapedAt": "2026-11-27T09:00:00.000Z",   // ISO timestamp of the collection
  "source": "https://portal.aai.aws.training",
  "warnings": ["Certifications: read 10 of 12 rows"],   // tabs not read completely

  "profile": {
    "name": "Jane Doe",
    "geo": "EMEA",
    "region": "FRANCE",
    "type": "External",
    "authorized": true,
    "statuses": { "Champion": true, "Freelancer": false, "Alumni": false }
  },

  "providers": ["Example Training Co"],            // Providers tab

  "progress": {                                    // Progress tab
    "ytd":  { "csat": 4.88, "responses": 140, "rate": 64, "days": 78 },
    "prev": { "csat": 4.91, "responses": 60,  "rate": 41, "days": 70 },
    "badges": [
      { "name": "AI Basecamp Badge", "done": true,
        "items": [ { "done": true, "text": "Certification: AWS Certified AI Practitioner" } ] }
    ]
  },

  "sessions": [                                    // Delivery CSAT tab, all years
    { "course": "Developing on AWS", "endDate": "2026-11-18",
      "students": 12, "csat": 5, "responseRate": 100 }
  ],

  "approved": [                                    // Approved Courses tab
    { "course": "Architecting on AWS", "days": 3, "greenlit": "2021-01-13",
      "firstDelivery": "2023-04-12", "lastDelivery": "2026-10-08",
      "deliveries": 12, "domain": "Solutions Architect" }
  ],

  "ramping": [ { "course": "Data Engineering on AWS", "days": 3 } ],   // Ramping Courses tab

  "certifications": [                              // Certifications tab
    { "name": "AWS Certified Developer - Associate", "expires": "2027-02-13", "expired": false }
  ]
}
```

## Field notes

| Field | Source column | Notes |
|---|---|---|
| `sessions[].students` | Students attended | `null` when the portal has not filled it in yet |
| `sessions[].csat` | Instructor csat score | `null` when the session has no score |
| `sessions[].responseRate` | Survey Response Rate | percentage, without `%` |
| `progress.ytd` / `prev` | Progress text | `null` if the text could not be parsed |
| `progress.*.rate` | Survey Response Rate | percentage |
| `approved[].deliveries` | Deliveries | `0` when empty |
| dates | — | ISO `YYYY-MM-DD`, `null` when empty |

The Progress tab notes that yearly CSAT and response rate exclude deliveries with more than 50 learners; delivery days include all deliveries.

Older versions of this object can be loaded by newer versions of the report as long as `version` is `1`. A breaking change to the format must increase `version`.
