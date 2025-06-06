import { firestore } from '@/firebaseConfig';
import { collection, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';

// Consulta para buscar todos os usuários
export async function fetchUsers() {
  try {
    const usersRef = collection(firestore, 'usuarios');
    const querySnapshot = await getDocs(usersRef);

    const users = querySnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    return users;
  } catch (error) {
    console.error('Erro ao buscar usuários:', error.message);
    throw new Error('Erro ao buscar usuários.');
  }
}

// Consulta para buscar todas as imagens
export async function fetchImages() {
  try {
    const imagesRef = collection(firestore, 'fotos');
    const querySnapshot = await getDocs(imagesRef);

    const images = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return images;
  } catch (error) {
    console.error('Erro ao buscar imagens:', error.message);
    throw new Error('Erro ao buscar imagens.');
  }
}

// Consulta para buscar todos os posts
export async function fetchPosts() {
  try {
    const postsRef = collection(firestore, 'posts');
    const querySnapshot = await getDocs(postsRef);

    const posts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return posts;
  } catch (error) {
    console.error('Erro ao buscar posts:', error.message);
    throw new Error('Erro ao buscar posts.');
  }
}

// Consulta para buscar todos os usuários em tempo real
export function observeUsers(callback: (users: any[]) => void) {
  try {
    const usersRef = collection(firestore, 'usuarios');
    const q = query(usersRef, orderBy('user'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(users);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Erro ao observar usuários:', error);
    throw new Error('Erro ao observar usuários.');
  }
}

// Consulta para buscar todas as imagens em tempo real
export function observeImages(callback: (images: any[]) => void) {
  try {
    const imagesRef = collection(firestore, 'fotos');
    const q = query(imagesRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const images = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(images);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Erro ao observar imagens:', error);
    throw new Error('Erro ao observar imagens.');
  }
}

// Consulta para buscar todos os posts em tempo real
export function observePosts(callback: (posts: any[]) => void) {
  try {
    const postsRef = collection(firestore, 'posts');
    const q = query(postsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(posts);
    });

    return unsubscribe;
  } catch (error) {
    console.error('Erro ao observar posts:', error);
    throw new Error('Erro ao observar posts.');
  }
}
