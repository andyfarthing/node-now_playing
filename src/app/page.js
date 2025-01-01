"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import artworkPlaceholder from "./images/artwork-placeholder.png";

import styles from "./css/now-playing-layout.module.css";

let webSocket;
if (typeof window !== "undefined") {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

	webSocket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
	setInterval(() => {
		if (webSocket.readyState !== webSocket.OPEN) {
			webSocket = new WebSocket(`${protocol}//${window.location.host}/api/ws`);
			return;
		}
		webSocket.send(`{"event":"ping"}`);
	}, 29000);
}

const Index = () => {
	const [metadata, setMetadata] = useState({});

	useEffect(() => {
		webSocket.onmessage = (event) => {
			if (event.data === "connection established") return;
			const metadata = JSON.parse(event.data);
			setMetadata(metadata);
		};
	}, []);

	return (
		<div className={styles.container} key={metadata.track?.id}>
			<div className={`${styles.header} ${styles["fade-in-left"]}`}>
				NOW PLAYING
			</div>
			<div className={`${styles.artwork} ${styles["fade-in"]}`}>
				<Image
					src={metadata.artwork || artworkPlaceholder}
					alt="artwork"
					width="250"
					height="250"
				/>
			</div>
			<div className={`${styles.artist} ${styles["fade-in-left"]}`}>
				{metadata.track?.artist.name || "Artist"}
			</div>
			<div className={`${styles.title} ${styles["fade-in-left"]}`}>
				{metadata.track?.title || "Title"}
			</div>
			<div className={`${styles.label} ${styles["fade-in-left"]}`}>
				[{metadata.track?.label.name || "Label"}]
			</div>
		</div>
	);
};

export default Index;
