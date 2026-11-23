# Meloy Startup Career Fair — Resume Bank

Check-in, resume bank and company registration for the Meloy Startup Career Fair at Texas A&M.

| Who | Link | What they do |
|---|---|---|
| Students | `/` (QR code) | Check in with name, email, major, graduation term and a PDF resume. Optional: "send me Meloy emails". After submit they see the main Meloy links (clicks are counted). |
| Companies, before the fair | `/register` (send by email) | Company, contact, up to 3 extra people (name + email), majors wanted, dietary restrictions. |
| Companies, at the fair | `/c/<company token>` (QR code) | Open resume bank: every student, filters, view or download resumes, CSV and ZIP export. No sign-in. |
| Staff | `/a/<admin token>` | QR codes and printable posters, registrations, students, exports (warm leads, students, registrations, activity, all resumes), delete a student, stats. |

There are no accounts. The two secret links are the only locks. They are random, kept in the
`settings` table, and printed in the server log on start. To set them yourself, use the
`COMPANY_TOKEN` and `ADMIN_TOKEN` environment variables. If the company link leaks, click
**Replace this link** on the staff page: the old link and old QR codes stop working at once.

## Run locally

```bash
createdb resume_bank
npm install
npm run dev          # http://localhost:3000, restarts on file changes
npm test             # end-to-end tests against postgres://localhost:5432/resume_bank_test
```

`DATABASE_URL` defaults to `postgres://localhost:5432/resume_bank`. Tables are created on start.

## Deploy and CI/CD

- **Hosting:** Render free web service + Render Postgres (see `render.yaml`).
- **CI:** `.github/workflows/ci.yml` runs a syntax check and the end-to-end tests against Postgres on every push and pull request.
- **CD:** after the tests pass on `main`, the workflow calls the Render deploy hook (`RENDER_DEPLOY_HOOK_URL` repository secret) and then checks `APP_URL/healthz` (`APP_URL` repository variable).

Limits of the free plan:
- The free Render Postgres database **expires 30 days after it is created**. Upgrade it to `basic_256mb` (about $6/month) or point `DATABASE_URL` at another Postgres (for example Neon free) before then.
- The free web service sleeps after 15 minutes without traffic; the first visit then takes up to a minute. Open the site 10 minutes before the fair.
- Resumes are stored in Postgres (the free web service has no lasting disk). 1 GB holds about 3,000 resumes.

## Edit content

`config.js`: event name, Meloy link buttons, majors list, "looking for" options, the "We provide" and "Please bring" text on the registration form.
