// Client-side data store using IndexedDB for persistence

export interface User {
  id: string
  email: string
  full_name: string
  role: "admin" | "user"
  is_disabled: boolean
  created_at: string
}

export interface Photo {
  id: string
  image_url: string
  is_public: boolean
  created_date: string
  created_by: string
}

export interface Background {
  id: string
  name: string
  image_url: string
  is_active: boolean
}

export interface AppConfig {
  access_window_hours: number
  maintenance_mode: boolean
}

const DB_NAME = "photobooth_db"
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("photos")) {
        const photoStore = db.createObjectStore("photos", { keyPath: "id" })
        photoStore.createIndex("created_by", "created_by", { unique: false })
      }
      if (!db.objectStoreNames.contains("backgrounds")) {
        db.createObjectStore("backgrounds", { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains("config")) {
        db.createObjectStore("config", { keyPath: "key" })
      }
    }
  })
}

// Generic CRUD operations
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getById<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function put<T>(storeName: string, item: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    store.put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function deleteItem(storeName: string, id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite")
    const store = tx.objectStore(storeName)
    store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// User operations
export const userStore = {
  getAll: () => getAll<User>("users"),
  getById: (id: string) => getById<User>("users", id),
  getByEmail: async (email: string): Promise<User | undefined> => {
    const users = await getAll<User>("users")
    return users.find((u) => u.email === email)
  },
  create: (user: User) => put("users", user),
  update: (user: User) => put("users", user),
  delete: (id: string) => deleteItem("users", id),
}

// Photo operations
export const photoStore = {
  getAll: () => getAll<Photo>("photos"),
  getByUser: async (userId: string): Promise<Photo[]> => {
    const photos = await getAll<Photo>("photos")
    return photos.filter((p) => p.created_by === userId).sort(
      (a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime()
    )
  },
  create: (photo: Photo) => put("photos", photo),
  update: (photo: Photo) => put("photos", photo),
  delete: (id: string) => deleteItem("photos", id),
}

// Background operations
export const backgroundStore = {
  getAll: () => getAll<Background>("backgrounds"),
  getActive: async (): Promise<Background[]> => {
    const bgs = await getAll<Background>("backgrounds")
    return bgs.filter((b) => b.is_active)
  },
  create: (bg: Background) => put("backgrounds", bg),
  update: (bg: Background) => put("backgrounds", bg),
  delete: (id: string) => deleteItem("backgrounds", id),
  seed: async () => {
    const existing = await getAll<Background>("backgrounds")
    if (existing.length === 0) {
      const defaults: Background[] = [
        { id: "bg-1", name: "Beach Sunset", image_url: "/backgrounds/beach-sunset.jpg", is_active: true },
        { id: "bg-2", name: "City Skyline", image_url: "/backgrounds/city-skyline.jpg", is_active: true },
        { id: "bg-3", name: "Mountain Lake", image_url: "/backgrounds/mountain-lake.jpg", is_active: true },
        { id: "bg-4", name: "Neon Studio", image_url: "/backgrounds/neon-studio.jpg", is_active: true },
        { id: "bg-5", name: "Garden", image_url: "/backgrounds/garden.jpg", is_active: true },
      ]
      for (const bg of defaults) {
        await put("backgrounds", bg)
      }
    }
  },
}

// Config operations
export const configStore = {
  get: async (): Promise<AppConfig> => {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction("config", "readonly")
      const store = tx.objectStore("config")
      const request = store.get("app_config")
      request.onsuccess = () => {
        if (request.result) {
          resolve({
            access_window_hours: request.result.access_window_hours,
            maintenance_mode: request.result.maintenance_mode,
          })
        } else {
          resolve({ access_window_hours: 24, maintenance_mode: false })
        }
      }
      request.onerror = () => reject(request.error)
    })
  },
  update: async (config: AppConfig) => {
    const db = await openDB()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction("config", "readwrite")
      const store = tx.objectStore("config")
      store.put({ key: "app_config", ...config })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },
}
