import { SharePage } from "./client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sharing Page"
}

export default function Home() {
    return (
    <SharePage />
)
}