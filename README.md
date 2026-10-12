# Cove

Cove is a self-hosted workspace for files, folders, documents, spreadsheets, and slides. The first person to open it creates the site and the first admin. After that, site settings live in Postgres and are changed from the admin panel.

## What you get

- My Drive, with folders, uploads, search, stars, and trash
- Documents, spreadsheets, and slides stored in the database
- Sharing with other people, plus an optional link
- Admin tools for accounts, invites, signup policy, quotas, and upload size

Spreadsheet formulas support cell references and `SUM`, `AVERAGE`, `MIN`, `MAX`, and `COUNT`.

## Run it locally

Cove expects Postgres at `postgresql://cove:cove@127.0.0.1:5432/cove`. That address is the default in the app. You do not need a `.env` file.

```bash
docker compose up -d db
npm install
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The setup wizard runs once, then you sign in as the admin you just created.

The database password in `compose.yaml` is a development fallback so this starts with one command. Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` in your shell before `docker compose up` when you want different credentials, and set `DATABASE_URL` to the matching URL for the app. That connection string is the only value that lives outside the database. Site name, registration, quotas, and the session secret are stored in Postgres.

Uploaded file bytes are written to `data/uploads`.

## Run the whole stack in Docker

```bash
docker compose up --build
```

The app listens on [http://127.0.0.1:3000](http://127.0.0.1:3000). Uploads are kept in the `uploads` volume.

## Tests

```bash
npm test
```

## License

MIT. See [LICENSE](LICENSE).
