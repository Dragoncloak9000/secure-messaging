"use client";
import { useRouter  } from "next/navigation";
import { db } from "../db";
import { useEffect, useRef, useState } from "react";

async function addContact(contact: { name: string, key: string }) {
    await db.contacts.add({
        name: contact.name,
        key: contact.key
    })
}

export function SharePage() {
    const router = useRouter()
    const handled = useRef(false);
    useEffect(() => {
        if (handled.current) {return;}
        handled.current = true
        const urlParams = new URLSearchParams(window.location.search)
        const key = urlParams.get('key')
        if (key != null) {
            const name = window.prompt(`Name for key ${key}`)
            if (name != null) {
                addContact({ name: name, key: Uint8Array.fromBase64(key, {alphabet: 'base64url'}).toBase64()})
            }
            router.replace("/")
        }
        else {
            router.replace("/")
        }
    }, [router])
    return (
        <div style={{ backgroundColor: 'black', height: '100vh' }}>
        </div>
    )
}