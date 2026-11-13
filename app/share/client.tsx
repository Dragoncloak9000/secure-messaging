"use client";
import { useRouter  } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addContact } from "../client";
import { ed25519 } from "@noble/curves/ed25519.js";

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
                const aesKey = localStorage.getItem("aesKey")
                const edPrivKey = localStorage.getItem("edKeyPriv")
                if (aesKey === null || edPrivKey === null) {
                    router.replace("/login")
                    return;
                }
                addContact({ name: name, key: Uint8Array.fromBase64(key, {alphabet: 'base64url'}).toBase64()}, Uint8Array.fromBase64(aesKey), ed25519.getPublicKey(Uint8Array.fromBase64(edPrivKey)))
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