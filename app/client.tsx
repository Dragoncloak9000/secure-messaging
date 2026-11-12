"use client";
import { useState, useEffect, useRef, act, Dispatch, SetStateAction, SubmitEventHandler } from "react";
import { redirect, RedirectType } from "next/navigation";
import { joinRoom, JoinRoom, MessageAction } from "trystero/nostr";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { db, Contact } from "./db";


function Header({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ flex: 2.5, backgroundColor: "#F2F0EF", display: 'grid', gridTemplateColumns: "1fr auto auto", borderBottom: 'solid', borderColor: 'darkgray'}}>
            {children}
        </div>
    )
}

function ContactButton({value, index, onClick}: {value: {name: string, key: string}, index: number, onClick: React.MouseEventHandler<HTMLButtonElement>}) {
    const [background, setBackground] = useState("transparent")
    return (
        <button key={index} onMouseEnter={event => setBackground("lightgrey")} onMouseLeave={event => setBackground("transparent")} onClick={onClick} data-id={value.key} style={{textAlign: 'left', padding: 5, outline: 'none', backgroundColor: background, backgroundRepeat: 'no-repeat', border: 'none', borderRadius: "5px"}}>{value.name}</button>
    )
}

function ContactButtonsList({ contacts, onClick }: { contacts: { name: string, key: string }[], onClick: React.MouseEventHandler<HTMLButtonElement> }) {
    return (
        <div style={{ flex: 100, display: 'flex', flexDirection: 'column', paddingTop: '5%', paddingLeft: '5%', paddingRight: '5%' }}>
            {contacts.map((x, i) => (<ContactButton key={i} value={x} index={i} onClick={onClick}/>))}
        </div>
    )
}

function ContactList({ contacts, onClick, newContact, setNewContact, handleSubmit }: { contacts: { name: string, key: string }[], onClick: React.MouseEventHandler<HTMLButtonElement>, newContact: string, setNewContact: Dispatch<SetStateAction<string>>, handleSubmit: SubmitEventHandler<HTMLFormElement> }) {
    return (
        <div style={{
            flex: 1, backgroundColor: 'whitesmoke', display: 'flex', flexDirection: 'column', overflow: 'auto', scrollbarWidth: 'none', height: "100%", minHeight: 0,
            borderRight: "solid", borderColor: 'darkgray'
        }
        }>
            <ContactButtonsList contacts={contacts} onClick={onClick}/>
            <form onSubmit={event => handleSubmit(event)} style={{ margin: 0, padding: 0, display: 'contents' }}>
                <input value={newContact} onChange={event => setNewContact(event.target.value)} style={{ flex: 2.5, backgroundColor: 'red', margin: 0 }}></input>
            </form>
        </div>
    )
}

function TextBox({ message, setMessage, handleKeyDown, connected }: { message: string, setMessage: Dispatch<SetStateAction<string>>, handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>, connected: boolean }) {
    if (connected) {
        return (
            <textarea onKeyDown={event => {
                handleKeyDown(event)
                if (event.key === 'Enter' && !event.shiftKey) {
                    setMessage("")
                }
            }} placeholder={"Enter Message"} value={message} onChange={event => setMessage(event.target.value)} style={{
                fieldSizing: 'content', width: "100%", backgroundColor: '#6495ed', borderRadius: 10, padding: 5, resize: 'none'
            }} />
        )
    }
    else {
        return null
    }
}

function MessageWindow({ messages, contact, handleKeyDown, message, setMessage, connected }: { messages: { index: number, value: string }[], contact: string, handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement>, message: string, setMessage: Dispatch<SetStateAction<string>>, connected: boolean }) {
    return (
        <div style={{ flex: 3, backgroundColor: 'lightgray', overflow: 'auto', scrollbarWidth: 'none', height: "100%", minHeight: 0 }}>
            <div style={{ paddingBottom: 25, paddingLeft: "10%", paddingRight: '10%', paddingTop: '1%', margin: 0 }}><p style={{ backgroundColor: 'royalblue', textAlign: 'center', margin: 0, overflowX: 'visible', borderRadius: "20px"}}>{connected ? contact : "NOT CONNECTED"}</p></div>
            {
                messages.map((message, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: message.index === 0 ? 'flex-start' : 'flex-end', padding: 10 }}>
                        <span style={{ backgroundColor: '#6495ed', borderRadius: 10, padding: 5, maxWidth: '35%', fieldSizing: 'content', overflowWrap: 'anywhere'}}>{message.value}</span>
                    </div>
                ))
            }
            <div style={{ display: 'flex', marginLeft: 'auto', padding: 10, minWidth: '10%', maxWidth: '35%' }}>
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

async function addContact(contact: { name: string, key: string }) {
    await db.contacts.add({
        name: contact.name,
        key: contact.key
    })
}

type Payload = { value: string, signature: string }
type tlsPayload = { value: { key: string, random: string }, signature: string }

export function ClientPage() {
    const [orgin, setOrgin] = useState("")
    const [messages, setMessages] = useState<{ value: string, index: number }[]>([])
    const [currentContact, setCurrentContact] = useState({ name: "Username", key: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" })
    const [contacts, setContacts] = useState<Contact[]>([])
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
    const [acceptedId, setAcceptedId] = useState("")
    const [tlsFinished, setTlsFinished] = useState<boolean>(false)
    const [, setReloadState] = useState("")
    const [, newTls] = useState("")
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

    // get contacts from indexedb
    useEffect(() => {
        db.contacts.toArray().then(cont => {
            setContacts(cont)
        })
    }, [changeDexie])

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
            redirect("/login", RedirectType.replace)
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
            appId: "com.example.chat"
        }, tempId)
        console.log(tempId)
        setRoomId(tempId)
        const action = room.makeAction<Payload>("action");
        if (!tlsFinished) {
            const tls = room.makeAction<tlsPayload>("tls")
            tls.onMessage = (data, { peerId }) => {
                const tlsRecivedValue = data.value
                if (ed25519.verify(Uint8Array.fromBase64(data.signature), encoder.encode(JSON.stringify(tlsRecivedValue)), Uint8Array.fromBase64(currentContact.key))) {
                    const [tempSelfKey, tempContactKey] = deriveKeys(x25519PrivKey, Uint8Array.fromBase64(data.value.key), selfRandom, Uint8Array.fromBase64(data.value.random))
                    setSelfKey(tempSelfKey)
                    setContactKey(tempContactKey)
                    setTlsFinished(true)
                    setAcceptedId(peerId)
                }
            }
            room.onPeerJoin = peerId => {
                const pubKey = x25519.getPublicKey(x25519PrivKey)
                const tlsSendValue = { key: pubKey.toBase64(), random: selfRandom.toBase64() }
                tls.send({ value: tlsSendValue, signature: ed25519.sign(encoder.encode(JSON.stringify(tlsSendValue)), Uint8Array.fromBase64(edPrivKeyTemp)).toBase64() }, { target: peerId })
            }
        }
        actionRef.current = action
        action.onMessage = (data, { peerId }) => {
            if (peerId === acceptedId) {
                if (ed25519.verify(Uint8Array.fromBase64(data.signature), Uint8Array.fromBase64(data.value), Uint8Array.fromBase64(currentContact.key))) {
                    const bytesData = Uint8Array.fromBase64(data.value)
                    const nonce = bytesData.slice(0, 12)
                    aes = gcm(contactKey, nonce, nonce)
                    const decrypted = aes.decrypt(bytesData.slice(12))
                    addToCurrentMessages({ value: decoder.decode(decrypted), index: 0 });
                }
            }
        }

    }, [x25519PrivKey, selfRandom, currentContact, contactKey, newTls]
    )

    function addToCurrentMessages(message: { value: string, index: number }) {
        setMessages(prev => [...prev, message])
    }

    function reloadState() {
        setReloadState(crypto.randomUUID())
    }

    function handleContactSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        let newCont = true
        if (newContact != "") {
            contacts.forEach((contact) => {
                if (contact.name === newContact) {
                    newCont = false
                    db.contacts.delete(contact.id)
                    newDexie(crypto.randomUUID())
                }
            })
            if (newCont) {
                const key = window.prompt("Person's Key")
                if (key != null) {
                    addContact({ name: newContact, key: key })
                    newDexie(crypto.randomUUID())
                }
            }
            setNewContact("")
            console.log("Sumbited")
        }
    }


    function handeClick(event: React.MouseEvent<HTMLButtonElement>) {
        if (event.currentTarget.dataset.id === undefined) {
            return;
        }
        const eventData = { name: event.currentTarget.textContent, key: event.currentTarget.dataset.id }
        setCurrentContact(eventData)
        if (currentContact != eventData) {
            setTlsFinished(false)
            newTls(crypto.randomUUID())
        }
    }

    function handleSignOut() {
        localStorage.removeItem("aesKey")
        localStorage.removeItem("edKey")
        redirect("/login", RedirectType.replace)
    }

    function submitMessage(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (message != '' && tlsFinished) {
                messages.push({ value: message, index: 1 });
                reloadState()
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
        console.log("Button Pressed")
    }

    return (
        <div style={{ height: "100vh", margin: 0, display: 'flex', flexDirection: 'column' }}>
            <Header>
                <h1 style={{ margin: 0, justifySelf: 'center' }}>Secure Messaging App</h1>
                <button onClick={shareIdButton}>Share Id</button>
                <button onClick={handleSignOut} style={{ justifySelf: 'right' }}>Sign Out</button>
            </Header>
            <div style={{ flex: 100, display: 'flex', flexDirection: 'row', minHeight: 0 }}>
                <ContactList contacts={contacts} onClick={handeClick} newContact={newContact} setNewContact={setNewContact} handleSubmit={handleContactSubmit} />
                <MessageWindow messages={messages} contact={currentContact.name} handleKeyDown={submitMessage} message={message} setMessage={setMessage} connected={tlsFinished} />
            </div>
        </div>
    )
}
;