import { firestore } from '@/firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';

// Fetch users from Firestore
export const fetchUsers = async () => {
  try {
    const usersRef = collection(firestore, 'users');
    const querySnapshot = await getDocs(usersRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return [];
  }
};

// Fetch posts from Firestore
export const fetchPosts = async () => {
  try {
    const postsRef = collection(firestore, 'posts');
    const querySnapshot = await getDocs(postsRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Erro ao buscar posts:', error);
    return [];
  }
};

// Fetch images from Firestore
export const fetchImages = async () => {
  try {
    const imagesRef = collection(firestore, 'fotos');
    const querySnapshot = await getDocs(imagesRef);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Erro ao buscar imagens:', error);
    return [];
  }
};
