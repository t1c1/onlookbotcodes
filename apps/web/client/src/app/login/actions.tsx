'use server';

import {
  getRedirectResult,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithEmailAndPassword,
  signInWithRedirect,
} from 'firebase/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@onlook/db/firebase';
import { SEED_USER } from '@onlook/db';
import { SignInMethod } from '@onlook/models';
import { Routes } from '@/utils/constants';

export async function login(provider: SignInMethod) {
  const origin = (await headers()).get('origin');
  
  let authProvider;
  switch (provider) {
    case 'google':
      authProvider = new GoogleAuthProvider();
      break;
    case 'github':
      authProvider = new GithubAuthProvider();
      break;
    default:
      throw new Error(`Provider ${provider} not supported`);
  }
  await signInWithRedirect(auth, authProvider);
}

export async function handleRedirect() {
  const result = await getRedirectResult(auth);
  if (result) {
    // User is signed in.
    // You can get the user info from result.user
    redirect(Routes.HOME);
  } else {
    // Handle the case where there is no redirect result
    redirect('/login');
  }
}

export async function devLogin() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Dev login is only available in development mode');
  }

  try {
    await signInWithEmailAndPassword(auth, SEED_USER.EMAIL, SEED_USER.PASSWORD);
    redirect(Routes.HOME);
  } catch (error) {
    console.error('Error signing in with password:', error);
    throw new Error('Error signing in with password');
  }
}