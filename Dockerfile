FROM node:18-alpine

WORKDIR /app

# 1️⃣ Copy package files
COPY package*.json ./

# 2️⃣ Copy prisma schema BEFORE install
COPY prisma ./prisma

# 3️⃣ Install deps
RUN npm install

# 4️⃣ 🔥 Generate Prisma client INSIDE container
RUN npx prisma generate

# 5️⃣ Copy rest of the app
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
