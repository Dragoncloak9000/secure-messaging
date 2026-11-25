"use client";
import { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction, SubmitEventHandler } from "react";
import { joinRoom } from "@trystero-p2p/ws-relay";
import type { MessageAction } from "@trystero-p2p/ws-relay";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import "../App.css"
import './css/home.css'


function Header({ children }: { children: React.ReactNode }) {
    return (
        <div className="app-header header-main">
            {children}
        </div>
    )
}

function ContactButton({ value, index, onClick }: { value: { name: string, key: string }, index: number, onClick: React.MouseEventHandler<HTMLButtonElement> }) {
    const [background, setBackground] = useState("transparent")
    return (
        <button
            className="contact-button" key={index}
            onMouseEnter={event => setBackground("lightgrey")} onMouseLeave={event => setBackground("transparent")}
            onClick={onClick} data-id={value.key} style={{ backgroundColor: background }}
        >{value.name}</button>
    )
}

function ContactButtonsList({ contacts, onClick }: { contacts: { name: string, key: string }[], onClick: React.MouseEventHandler<HTMLButtonElement> }) {
    return (
        <div className="contact-button-list">
            {contacts.map((x, i) => (<ContactButton key={i} value={x} index={i} onClick={onClick} />))}
        </div>
    )
}

function ContactList({ contacts, onClick, newContact, setNewContact, handleSubmit }: { contacts: { name: string, key: string }[], onClick: React.MouseEventHandler<HTMLButtonElement>, newContact: string, setNewContact: Dispatch<SetStateAction<string>>, handleSubmit: SubmitEventHandler<HTMLFormElement> }) {
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
type tlsPayload = { value: { key: string, random: string }, signature: string }

export default function Home() {
    const [orgin, setOrgin] = useState("")
    const [messages, setMessages] = useState<{ value: string, index: number }[]>([])
    const [currentContact, setCurrentContact] = useState({ name: "Username", key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" })
    const [contacts, setContacts] = useState<{ name: string, key: string }[]>([])
    const [newContact, setNewContact] = useState("")
    const [aesKey, setAesKey] = useState<Uint8Array>(new Uint8Array(0))
    const [edPrivKey, setEdPrivKey] = useState<Uint8Array>(new Uint8Array(0))
    const [edPubKey, setEdPubKey] = useState<Uint8Array>(new Uint8Array(0))
    const [x25519PrivKey, setX25519PrivKey] = useState(new Uint8Array(0))
    const [selfRandom, setSelfRandom] = useState(new Uint8Array(0))
    const [selfKey, setSelfKey] = useState(new Uint8Array(0))
    const [contactKey, setContactKey] = useState(new Uint8Array(0))
    const [message, setMessage] = useState("")
    const [roomId, setRoomId] = useState("")
    const [tlsFinished, setTlsFinished] = useState<boolean>(false)
    const [newTls, setNewTls] = useState("")
    const [changeDexie, newDexie] = useState("")
    const actionRef = useRef<MessageAction<Payload> | null>(null)
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()
    let nonce: Uint8Array;
    let aes;
    let encrypted: Uint8Array;

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

    // tls and room logic
    useEffect(() => {
        if (x25519PrivKey.length === 0) {
            return;
        }
        if (selfRandom.length === 0) {
            return;
        }
        const encoder = new TextEncoder()
        const aesKeyTemp = localStorage.getItem("aesKey")
        const edPrivKeyTemp = localStorage.getItem("edKeyPriv")
        if (aesKeyTemp === null || edPrivKeyTemp === null) {
            return
        }
        if (aesKeyTemp != null && edPrivKeyTemp != null) {
            setAesKey(Uint8Array.fromBase64(aesKeyTemp))
            setEdPrivKey(Uint8Array.fromBase64(edPrivKeyTemp))
            setEdPubKey(ed25519.getPublicKey(Uint8Array.fromBase64(edPrivKeyTemp)))
        }
        if (edPubKey.length === 0 && edPrivKey.length != 0) {
            setEdPubKey(ed25519.getPublicKey(edPrivKey))
        }
        const roomList = [currentContact.key, ed25519.getPublicKey(Uint8Array.fromBase64(edPrivKeyTemp)).toBase64()]
        roomList.sort()
        const tempId = roomList.join("")
        const room = joinRoom({
            appId: "username/custom-secure-chat-protcol",
            relayConfig: { urls: ["wss://192.168.4.84:3001/relay"] }
        }, tempId)
        room.onError((err) => console.error("Room error:", err));
        console.log("Connected")
        console.log(tempId)
        setRoomId(tempId)
        const action = room.makeAction<Payload>("action");
        let unsubscribeTls = () => { }
        let unsubscribePeerJoin = () => { }
        if (!tlsFinished) {
            const tls = room.makeAction<tlsPayload>("tls")
            unsubscribeTls = tls.onMessage((data) => {
                console.log(data)
                const tlsRecivedValue = data.value
                if (ed25519.verify(Uint8Array.fromBase64(data.signature), encoder.encode(JSON.stringify(tlsRecivedValue)), Uint8Array.fromBase64(currentContact.key))) {
                    const [tempSelfKey, tempContactKey] = deriveKeys(x25519PrivKey, Uint8Array.fromBase64(data.value.key), selfRandom, Uint8Array.fromBase64(data.value.random))
                    setSelfKey(tempSelfKey)
                    setContactKey(tempContactKey)
                    setTlsFinished(true)
                    console.log("TLS finished")
                }
            }
            )
            unsubscribePeerJoin = room.onPeerJoin(({ peerId }) => {
                const pubKey = x25519.getPublicKey(x25519PrivKey)
                const tlsSendValue = { key: pubKey.toBase64(), random: selfRandom.toBase64() }
                tls.send({ value: tlsSendValue, signature: ed25519.sign(encoder.encode(JSON.stringify(tlsSendValue)), Uint8Array.fromBase64(edPrivKeyTemp)).toBase64() }, { target: peerId })
                console.log("TLS SENT")
            }
            )
        }
        actionRef.current = action
        const unsubscribeAction = action.onMessage((data) => {
            if (ed25519.verify(Uint8Array.fromBase64(data.signature), Uint8Array.fromBase64(data.value), Uint8Array.fromBase64(currentContact.key))) {
                const bytesData = Uint8Array.fromBase64(data.value)
                const nonce = bytesData.slice(0, 12)
                aes = gcm(contactKey, nonce, nonce)
                const decrypted = aes.decrypt(bytesData.slice(12))
                addToCurrentMessages({ value: decoder.decode(decrypted), index: 0 });
            }

        }
        )
        return () => {
            unsubscribeTls()
            unsubscribePeerJoin()
            unsubscribeAction()
            room.leave()
        }
    }, [x25519PrivKey, selfRandom, currentContact, contactKey, newTls]
    )


    function addToCurrentMessages(message: { value: string, index: number }) {
        setMessages(prev => [...prev, message])
    }

    async function handleContactSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        let newCont = true
        if (newContact != "") {
            contacts.forEach(async (contact) => {
                if (contact.name === newContact) {
                    newCont = false
                    const contactToRemove = contacts.find(item => item.name === newContact)
                    if (contactToRemove === undefined) { return }
                    newDexie(crypto.randomUUID())
                }
            })
            if (newCont) {
                const key = window.prompt("Person's Key")
                if (key != null) {
                    newDexie(crypto.randomUUID())
                }
            }
            setNewContact("")
        }
    }


    function handeClick(event: React.MouseEvent<HTMLButtonElement>) {
        if (event.currentTarget.dataset.id === undefined) {
            return;
        }
        const eventData = { name: event.currentTarget.textContent, key: event.currentTarget.dataset.id }
        setCurrentContact(eventData)
        if (currentContact !== eventData) {
            setTlsFinished(false)
            setNewTls(crypto.randomUUID())
        }
    }

    function handleSignOut() {
        localStorage.removeItem("aesKey")
        localStorage.removeItem("edKeyPriv")
        redirect("/login", RedirectType.replace)
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
                actionRef.current?.send(messagePayload)
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