# Design Portfolio Upload App

This project gives you a graphic designer portfolio where:

- the frontend is built with `HTML`, `CSS`, and vanilla `JavaScript`
- the backend is built with `TypeScript` and `Express`
- project images are uploaded to `Supabase Storage`
- the returned public image URL is stored in `MongoDB`

## 1. Install dependencies

```bash
npm install
```

## 2. Create your environment file

Copy `.env.example` to `.env` and fill in:

- `MONGODB_URI`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`

Important:

- create the Supabase bucket first
- make the bucket public if you want `getPublicUrl()` images to display directly in the portfolio

## 3. Run the app

```bash
npm run dev
```

Then open:

```bash
http://localhost:4000
```

## API routes

- `GET /api/projects` returns all portfolio projects
- `POST /api/projects` uploads an image to Supabase and stores the project in MongoDB
- `DELETE /api/projects/:id` removes the image from Supabase and deletes the project record
