import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase/config';

export const app = initializeApp(firebaseConfig);