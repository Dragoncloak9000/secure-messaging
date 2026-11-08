"use client";
import { useEffect, useState, useRef } from "react"
import { joinRoom, MessageAction } from "trystero";

export default function Home() {
    const [roomId, setRoomId] = useState("")
    const actionRef = useRef<MessageAction | null>(null)
    useEffect(() => {
        if (roomId === "") { return }
        const room = joinRoom({
            appId: "com.example.chat"
        }, roomId)
        const action = room.makeAction("action")
        actionRef.current = action
    }, [roomId])
    return (
        <div>
            <h1>Room Id</h1>
            <input value={roomId} onChange={event => setRoomId(event.target.value)} />
            <h1>Message to be sent</h1>
            <input onChange={event => actionRef.current?.send({value: event.target.value, sig: ''})}/>
        </div>
    )
}