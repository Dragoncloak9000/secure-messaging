import { Metadata } from 'next';
import { ClientPage } from './client';

export const metadata: Metadata = {
  title: "Secure Messaging"
}

export default function Home() {
  return <ClientPage/>
}