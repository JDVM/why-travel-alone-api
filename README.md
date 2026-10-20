# Why Travel Alone

## Introduction

Why Travel Alone is a small passion project that began as my capstone for the Brainstation June 2023 cohort. It has now evolved into an ongoing project where I can showcase my skills. In this back-end section of the project, I will demonstrate my ability to design comprehensive databased that use joined tables to gather and output data from multuiple sources. You can find the corresponding front-end API [here](https://github.com/JDVM/why-travel-alone.git).

## Technologies

- React
- JavaScript
- Axios
- SASS
- React Router DOM
- React Icons
- Knex
- MySQL

## Setup

### Front-End

1. Clone the repository: `https://github.com/JDVM/why-travel-alone.git`
2. Install dependencies: `npm install axios sass react-router-dom`
3. Run the application: `npm start`

### Back-end

1. Clone the repository: `https://github.com/JDVM/why-travel-alone-api.git`
2. Install dependencies: `npm install` (Node 20 or newer; `.nvmrc` pins 22)
3. Run the application: `npm run dev` (restarts on file changes), or `npm start` in production. The server won't start until `.env` has a `JWT_SECRET` of at least 32 characters; see `.env.example`.

If you encounter any issues, please feel free to contact me via GitHub.

### Database Setup

- Create a database in MySQL
- Create an `.env` file using the `.env.example` file to format appropriate variables (screenshot)

- ![image](https://github.com/JDVM/why-travel-alone-api/assets/40014232/001c2c3d-c61c-4c1d-9907-44f9c6fb288c)

- In the terminal, run `npm run migrate` to apply the latest migration files
- Seed the database by running `npm run seed` to populate it with the latest data

### Running tests

The tests run against a real MySQL database, separate from your development one, because they wipe and re-seed it.

1. Create an empty database, e.g. `CREATE DATABASE wta_test;`, and grant your database user access to it
2. Add `DB_TEST_DBNAME=wta_test` to `.env`
3. Run `npm test`

GitHub Actions runs the same tests against MySQL 8 on every pull request (`.github/workflows/ci.yml`).

### Logs and error reporting

- The API writes JSON logs to stdout, one line per event, for the hosting platform to collect. `LOG_LEVEL` sets the detail (`info` by default; tests are silent). To read them locally, pipe through `npx pino-pretty`.
- Every request gets an id, returned in the `X-Request-Id` response header and attached to all of that request's log lines. A well-formed `X-Request-Id` from a proxy in front of the API is reused.
- Logs carry account ids, never emails, passwords, tokens, headers or request bodies. Failed logins log a keyed hash of the email (`emailTag`), so repeated attempts on one address can be spotted.
- Auth events have an `event` field: `auth.register`, `auth.login`, `auth.login_failed`, `auth.rate_limited`.
- Set `SENTRY_DSN` to send unexpected errors (500s, crashes) to Sentry. Events carry the account id, request id and route only: no IP address, headers, cookies, query strings or bodies.

## Features

- Trips: Add, Edit, Delete trips
- Accounts: every user is a traveler. Register with a name, then fill in the rest of the profile
- Travelers: browse other travelers when logged in. Kids and special considerations are visible only to the traveler and to owners of trips they're on
- Invitations: trip owners invite travelers, who accept or decline. Members can view a trip and leave it; only the owner can change it
- Privacy:
  - Signing up requires accepting the terms and privacy policy; the accepted version (`TERMS_VERSION` in `config.js`) and time are stored.
  - Special considerations can describe health conditions, so they're only stored with explicit consent (`special_considerations_consent: true` on `PUT /profile`). Clearing the field withdraws it.
  - `GET /account/export` downloads everything stored about the caller as JSON. `DELETE /account` (with the password) deletes the account, its profile and the trips it owns.
- Fully responsive with a mobile-first design

## Lessons Learned

The biggest lesson I learned from this project is the complexity of the backend design process. During the initial project design, I was not aware of how complex the queries would need to be in order to properly retrieve the data. Learning to use different joins as part of the query showed me that all of the data doesn't have to be in a single database; it can be in multiple sources and joined together based on the needs of the query. This also showed me that spreading the data out and creating multiple relationships can be beneficial.

For the frontend, I learned a few things as well. I found that combining the `map` method with a select option is very useful. I also learned about the different types of overflow options. While the initial plan was to use a library to create the frontend, in the end, I had to scrap that idea and create the components from scratch, as I was spending too much development time trying to figure out how they worked.

## Next Steps

**Milestones:**
1. Apply a sorting function to narrow down results based on different categories.
2. Add more icons to enhance user interface.
3. Implement hotel and flight search for the site.
