import React, { useState } from "react";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
    const navigate = useNavigate()
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    async function passwordSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        if (username != "" && password != "") {
            const encoder = new TextEncoder()
            const salt = sha256(encoder.encode(username))
            const main = await scryptAsync(encoder.encode(password), salt, { N: 2 ** 16, r: 8, p: 1, dkLen: 32 })
            const hkdfSalt = sha256(salt)
            const aesKey = hkdf(sha256, main, hkdfSalt, Uint8Array.from([65, 101, 115, 45, 75, 101, 121]), 32)
            const edKey = hkdf(sha256, main, hkdfSalt, Uint8Array.from([69, 100, 50, 53, 53, 49, 57, 45, 75, 101, 121]), 32)
            localStorage.setItem("aesKey", aesKey.toBase64())
            localStorage.setItem("edKeyPriv", edKey.toBase64())
            setUsername("")
            setPassword("")
            navigate("/")
        }
    }
    return (
        <div style={{ backgroundColor: 'black', height: "100vh", display: "flex", flexDirection: "column" }}>
            <p style={{ color: 'white', alignSelf: 'center', paddingTop: '10vh' }}>Username</p>
            <input value={username} onChange={(event) => setUsername(event.target.value)} style={{ width: "20vh", alignSelf: 'center' }} />
            <p style={{ color: "white", alignSelf: 'center', paddingTop: '5vh', paddingBottom: '2.5vh' }}>Password</p>
            <form onSubmit={e => passwordSubmit(e)} style={{ alignSelf: 'center', width: '20vh' }}>
                <input value={password} onChange={(event) => setPassword(event.target.value)} style={{ width: "20vh" }} />
            </form>
        </div>
    )
}