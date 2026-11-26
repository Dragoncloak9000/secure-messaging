"use client";
import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, SubmitEventHandler } from "react";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import "../App.css"
import './css/home.css'
import { useNavigate } from "react-router-dom";
import { entropyToMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { gdb } from "genosdb";

const db = await gdb("Secure-Chat-by-Dragoncloak9000", { rtc: true, sm: { superAdmins: [], resume: false } })
if (!db.room || !db.sm) {
    throw new Error("No room or securitity manager")
}
const channel = db.room.channel('main')

function Header({ children }: { children: React.ReactNode }) {
    return (
        <div className="app-header header-main">
            {children}
        </div>
    )
}

function ContactButton({ value, index, onClick }: { value: { name: string, key: string, address: string }, index: number, onClick: React.MouseEventHandler<HTMLButtonElement> }) {
    const [background, setBackground] = useState("transparent")
    return (
        <button
            className="contact-button" key={index}
            onMouseEnter={event => setBackground("lightgrey")} onMouseLeave={event => setBackground("transparent")}
            onClick={onClick} data-id={value.key} style={{ backgroundColor: background }}
            data-address={value.address}
        >{value.name}</button>
    )
}

function ContactButtonsList({ contacts, onClick }: { contacts: { name: string, key: string, address: string }[], onClick: React.MouseEventHandler<HTMLButtonElement> }) {
    return (
        <div className="contact-button-list">
            {contacts.map((x, i) => (<ContactButton key={i} value={x} index={i} onClick={onClick} />))}
        </div>
    )
}

function ContactList({ contacts, onClick, newContact, setNewContact, handleSubmit }: { contacts: { name: string, key: string, address: string }[], onClick: React.MouseEventHandler<HTMLButtonElement>, newContact: string, setNewContact: Dispatch<SetStateAction<string>>, handleSubmit: SubmitEventHandler<HTMLFormElement> }) {
    return (
        <div className="contact-main-div">
            <ContactButtonsList contacts={contacts} onClick={onClick} />
            <form className="contact-button-form" onSubmit={event => handleSubmit(event)}>
                <input className="contact-input" value={newContact} onChange={event => setNewContact(event.target.value)}></input>
            </form>
        </div>
    )
}

function TextBox({ message, setMessage, handleKeyDown, connected }: { message: string, setMessage: Dispatch<SetStateAction<string>>, handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>, connected: boolean }) {
    if (connected) {
        return (
            <textarea className="message-textbox" onKeyDown={event => {
                handleKeyDown(event)
                if (event.key === 'Enter' && !event.shiftKey) {
                    setMessage("")
                }
            }} placeholder={"Enter Message"} value={message} onChange={event => setMessage(event.target.value)} />
        )
    }
    else {
        return null
    }
}

function MessageWindow({ messages, contact, handleKeyDown, message, setMessage, connected }: { messages: { index: number, value: string }[], contact: string, handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>, message: string, setMessage: Dispatch<SetStateAction<string>>, connected: boolean }) {
    return (
        <div className="message-main-div">
            <div className="message-contact-header-div"><p className="message-contact-title">{connected ? contact : "NOT CONNECTED"}</p></div>
            {
                messages.map((message, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: message.index === 0 ? 'flex-start' : 'flex-end', padding: 10 }}>
                        <span className="message-span">{message.value}</span>
                    </div>
                ))
            }
            <div className="message-textbox-div">
                <TextBox message={message} setMessage={setMessage} handleKeyDown={handleKeyDown} connected={connected} />
            </div>
        </div>
    )
}

function combineBytes(arr: Uint8Array[]) {
    const totalLen = arr.reduce((total, array) => total + array.byteLength, 0);
    const res = new Uint8Array(totalLen);
    let offset = 0;
    arr.forEach((array) => {
        res.set(array, offset)
        offset += array.byteLength
    })
    return res
}

function deriveKeys(privKey: Uint8Array, pubKey: Uint8Array, selfRand: Uint8Array, contactRand: Uint8Array) {
    const combinedRand = [selfRand, contactRand]
    combinedRand.sort()
    const preSalt = combineBytes([Uint8Array.from([83, 101, 99, 117, 114, 101, 45, 67, 104, 97, 116, 45, 49, 46, 48
    ]), ...combinedRand]);
    const salt = sha256(preSalt);
    const sharedSecret = x25519.getSharedSecret(privKey, pubKey);
    const selfKey = hkdf(sha256, sharedSecret, salt, sha256(x25519.getPublicKey(privKey)), 32);
    const contactKey = hkdf(sha256, sharedSecret, salt, sha256(pubKey), 32);
    return [selfKey, contactKey]
}


type Payload = { value: string, signature: string }

export default function Home() {
    const nav = useNavigate()
    const [username, setUsername] = useState("")
    const [address, setAddress] = useState("")
    const [sentTls, setSentTls] = useState(false)
    const [contactKey, setContactKey] = useState(new Uint8Array(0))
    const [orgin, setOrgin] = useState("")
    const [messages, setMessages] = useState<{ value: string, index: number }[]>([])
    const [currentContact, setCurrentContact] = useState({ name: "Username", key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", address: "0x" })
    const [contacts, setContacts] = useState<{ name: string, key: string, address: string }[]>([{ name: "b b (p2)", key: "yZ18+o9FdzDIEA1ZBVQz7LSELnYmM3D37xb1oWo633w=", address: "0xA4e2076AeEb223C0D146e444211Dbb7C06D6B33a" }, { name: "a a (p1)", key: "T1eBODe41C+C8VxExmDuNt85lryhpAVB2QBPWAIQ4CM=", address: "0x1F5d6AEF76f2d8b330aB457c2CF4AF41E4f7C402" }])
    const [newContact, setNewContact] = useState("")
    const [aesKey, setAesKey] = useState<Uint8Array>(new Uint8Array(0))
    const [edPrivKey, setEdPrivKey] = useState<Uint8Array>(new Uint8Array(0))
    const [edPubKey, setEdPubKey] = useState<Uint8Array>(new Uint8Array(0))
    const [x25519PrivKey, setX25519PrivKey] = useState(new Uint8Array(0))
    const [selfRandom, setSelfRandom] = useState(new Uint8Array(0))
    const [selfKey, setSelfKey] = useState(new Uint8Array(0))
    const [message, setMessage] = useState("")
    const [tlsFinished, setTlsFinished] = useState<boolean>(false)
    const [newTls, setNewTls] = useState("")
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    const stateRef = useRef({
        edPubKey,
        currentContact,
        sentTls,
        x25519PrivKey,
        selfRandom,
        edPrivKey,
        contactKey
    })
    stateRef.current = { edPubKey, currentContact, sentTls, x25519PrivKey, selfRandom, edPrivKey, contactKey }
    let nonce: Uint8Array;
    let aes;
    let encrypted: Uint8Array;

    useEffect(() => {
        channel.on("message", (data, peerId) => {
            peerId;
            if (data.target === stateRef.current.edPubKey.toBase64()) {
                if (data.type === "tls") {
                    if (!stateRef.current.sentTls) {
                        const message = { key: x25519.getPublicKey(stateRef.current.x25519PrivKey).toBase64(), random: stateRef.current.selfRandom.toBase64() }
                        const messageBytes = encoder.encode(JSON.stringify(message))
                        const signature = ed25519.sign(messageBytes, stateRef.current.edPrivKey).toBase64()
                        channel.send({ payload: { message: message, signature: signature }, type: "tls", target: stateRef.current.currentContact.key});
                        setSentTls(true)
                    }
                    const message: { key: string, random: string } = data.payload.message
                    const signature: string = data.payload.signature
                    const messageBytes = encoder.encode(JSON.stringify(message))
                    const valid = ed25519.verify(Uint8Array.fromBase64(signature), messageBytes, Uint8Array.fromBase64(stateRef.current.currentContact.key))
                    if (!valid) { return }
                    const [tempSelf, tempContact] = deriveKeys(stateRef.current.x25519PrivKey, Uint8Array.fromBase64(message.key), stateRef.current.selfRandom, Uint8Array.fromBase64(message.random))
                    setSelfKey(tempSelf)
                    setContactKey(tempContact)
                    setTlsFinished(true)
                }
                else if (data.type === "message") {
                    console.log("Recived Message")
                    handlePayload(data)
                }
            }
        }
        )
    }, [])

    // get orgin
    useEffect(() => {
        setOrgin(window.location.origin)
    }, [])

    // generate temporary random
    useEffect(() => {
        if (x25519PrivKey.length === 0) {
            setX25519PrivKey(x25519.keygen().secretKey)
        }
        if (selfRandom.length === 0) {
            setSelfRandom(crypto.getRandomValues(new Uint8Array(32)))
        }
    }, [newTls])

    //localstorage
    useEffect(() => {
        const aes = localStorage.getItem("aesKey")
        const ed = localStorage.getItem("edKeyPriv")
        const name = localStorage.getItem("username")
        if (aes === null || ed === null || name === null) {
            nav("/login")
            return
        }
        setAesKey(Uint8Array.fromBase64(aes))
        setEdPrivKey(Uint8Array.fromBase64(ed))
        setEdPubKey(ed25519.getPublicKey(Uint8Array.fromBase64(ed)))
        setUsername(name)
    }, [])

    // tls and room logic
    useEffect(() => {
        if (x25519PrivKey.length === 0 || selfRandom.length === 0 || edPrivKey.length === 0) {
            return;
        }
        const message = { key: x25519.getPublicKey(x25519PrivKey).toBase64(), random: selfRandom.toBase64() }
        const messageBytes = encoder.encode(JSON.stringify(message))
        const signature = ed25519.sign(messageBytes, edPrivKey).toBase64()
        channel.send({ payload: { message: message, signature: signature }, type: "tls", target: currentContact.key, selfKey: edPubKey.toBase64() });
        // }, [])
    }, [x25519PrivKey, selfRandom, edPrivKey, currentContact, sentTls])


    useEffect(() => {
        if (edPrivKey.length === 0) {
            return
        }
        const setMnemonic = async () => {

            const mn = entropyToMnemonic(edPrivKey, wordlist)
            await db.sm?.loginOrRecoverUserWithMnemonic(mn)
            const tempAddress = db.sm?.getActiveEthAddress()
            if (!tempAddress) { return }
            setAddress(tempAddress)
        }
        setMnemonic()
    }, [aesKey, edPrivKey])


    async function handleContactSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        let newCont = true
        if (newContact != "") {
            contacts.forEach(async (contact) => {
                if (contact.name === newContact) {
                    newCont = false
                    const contactToRemove = contacts.find(item => item.name === newContact)
                    if (contactToRemove === undefined) { return }
                }
            })
            if (newCont) {
                const key = window.prompt("Person's Key")
                if (key != null) {
                }
            }
            setNewContact("")
        }
    }


    function handeClick(event: React.MouseEvent<HTMLButtonElement>) {
        if (!event.currentTarget.dataset.id || !event.currentTarget.dataset.address) {
            return;
        }
        const eventData = { name: event.currentTarget.textContent, key: event.currentTarget.dataset.id, address: event.currentTarget.dataset.address }
        setCurrentContact(eventData)
        if (currentContact !== eventData) {
            setTlsFinished(false)
            setSentTls(false)
            setNewTls(crypto.randomUUID())
        }
    }

    function handleSignOut() {
        localStorage.removeItem("aesKey")
        localStorage.removeItem("edKeyPriv")
        nav("/login")
    }

    function handlePayload(payload: { payload: { value: string, signature: string }, type: string }) {
        const message = Uint8Array.fromBase64(payload.payload.value)
        const signature = Uint8Array.fromBase64(payload.payload.signature)
        const valid = ed25519.verify(signature, message, Uint8Array.fromBase64(stateRef.current.currentContact.key))
        console.log(valid)
        if (!valid) { return }
        const nonce = message.slice(0, 12)
        const aes = gcm(stateRef.current.contactKey, nonce, nonce)
        const decrypted = decoder.decode(aes.decrypt(message.slice(12)))
        setMessages(prev => [...prev, { value: decrypted, index: 0 }])
    }

    function submitMessage(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (message != '' && tlsFinished) {
                messages.push({ value: message, index: 1 });
                nonce = randomBytes(12)
                aes = gcm(selfKey, nonce, nonce)
                encrypted = aes.encrypt(encoder.encode(message))
                encoder.encode(message)
                const messagePayload = { value: combineBytes([nonce, encrypted]).toBase64(), signature: ed25519.sign(combineBytes([nonce, encrypted]), edPrivKey).toBase64() }
                console.log(messagePayload)
                channel.send({ payload: messagePayload, type: "message", target: currentContact.key })
            }
        }
        else {
        }
    }

    function shareIdButton() {
        navigator.clipboard.writeText(orgin + '/share?key=' + edPubKey.toBase64({ alphabet: 'base64url' }))
    }

    return (
        <div className="app-main-div main-div">
            <Header>
                <h1 className="header-title">Secure Messaging App</h1>
                <button onClick={shareIdButton}>Share Id</button>
                <button onClick={handleSignOut}>Sign Out</button>
            </Header>
            <div className="message-contact-div">
                <ContactList contacts={contacts} onClick={handeClick} newContact={newContact} setNewContact={setNewContact} handleSubmit={handleContactSubmit} />
                <MessageWindow messages={messages} contact={currentContact.name} handleKeyDown={submitMessage} message={message} setMessage={setMessage} connected={tlsFinished} />
            </div>
        </div>
    )
}
;