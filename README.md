# Onlinekart (REDKART)

A brutalist retro 3D kart racing game built with Next.js, Three.js, Rapier Physics, and Socket.io. Features full multiplayer synchronization, a Constructivist UI, and Supabase Google Authentication with a persistent global leaderboard.

## Features
- **Arcade Physics**: Drifting, body tilt, steerable wheels, camera lean.
- **Online Multiplayer**: Real-time room sync and position interpolation.
- **Database Architecture**: Google Login, Player Profiles, Global Hall of Fame.
- **Pro UI**: 3D kart showcase lobby, dual-tab leaderboards, dynamic speedo.

## How to Run
```bash
npm install
npm run dev:mp
```
Open http://localhost:3000

## Environment Variables
Create a `.env.local` file with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```
