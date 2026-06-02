# Déploiement Valcausse

## 1. Installer Node.js

Téléchargez et installez Node.js LTS depuis **https://nodejs.org**  
Redémarrez le Terminal après installation.

Vérifiez : `node --version` → doit afficher v18 ou v20+

---

## 2. Créer le projet Supabase

1. Allez sur **https://supabase.com** → New Project
2. Notez :
   - **Project URL** (ex: `https://abcdef.supabase.co`)
   - **anon/public key** (Settings → API)
   - **service_role key** (Settings → API → secret, à garder confidentiel)
3. Dans l'éditeur SQL (SQL Editor → New query), collez et exécutez tout le contenu de `schema.sql`

---

## 3. Configurer les variables d'environnement

Copiez `.env.local.example` → `.env.local` et remplissez :

```
NEXT_PUBLIC_SUPABASE_URL=https://votre-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
ADMIN_PASSWORD=votre_mot_de_passe_admin
NEXTAUTH_SECRET=une_chaine_aleatoire_de_32_caracteres
```

---

## 4. Installer et lancer en local

```bash
cd "Valcausse"
npm install
npm run dev
```

Ouvrez **http://localhost:3000**

---

## 5. Déployer sur Vercel

### Via l'interface GitHub

1. Créez un repository GitHub : `git init && git add . && git commit -m "init" && git remote add origin ... && git push`
2. Allez sur **https://vercel.com** → Add New Project → importez le repo
3. Dans **Environment Variables**, ajoutez les 5 variables de `.env.local`
4. Cliquez **Deploy**

### Via CLI Vercel (plus rapide)

```bash
npm install -g vercel
vercel --prod
```

Vercel détecte automatiquement Next.js et configure tout.

---

## 6. Variables d'environnement Vercel

Ajoutez dans Settings → Environment Variables :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD`
- `NEXTAUTH_SECRET`

---

## 7. Utilisation

- **Lecture** : accessible à tous sans mot de passe
- **Écriture/Admin** : cliquez "Connexion admin" dans la barre gauche
- **Mot de passe** : celui défini dans `ADMIN_PASSWORD`
- **Session** : 8h (journée de travail complète)

---

## Logo Valcausse

Placez votre logo dans `/public/logo.png` — il remplacera automatiquement le placeholder dans les PDF générés si vous ajustez `src/app/api/pdf/transporteur/route.ts`.
