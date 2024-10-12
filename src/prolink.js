import {
	bringOnline,
	MixstatusProcessor,
	MixstatusMode,
} from "prolink-connect";
import { getMusicBrainzArtwork } from "./musicbrainz.js";

export const startProlinkNetwork = async () => {
	const proLinkNetwork = await connectToProlinkNetwork();
	startListener(proLinkNetwork);
	// Listen for SIGINT signal (CTRL + C)
	process.on("SIGINT", async () => handleSignal("SIGINT", proLinkNetwork));
	// Listen for SIGTERM signal (sent by `kill` command)
	process.on("SIGTERM", async () => handleSignal("SIGTERM", proLinkNetwork));
	// Listen for SIGHUP signal (sent when terminal is closed)
	process.on("SIGHUP", async () => handleSignal("SIGHUP", proLinkNetwork));
};

let websocket = undefined;

export const setupProLinkWebsocket = (ws) => {
	websocket = ws;
};

const disconnectFromProlinkNetwork = async (proLinkNetwork) => {
	if (!proLinkNetwork?.isConnected()) return;
	try {
		// Wrap cleanup logic in a Promise to manage timeout
		await Promise.race([
			(async () => {
				console.log("Disconnecting from ProLink network...");
				await proLinkNetwork.disconnect();
				console.log("Disconnected from ProLink network");
			})(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Cleanup timed out")), 5000)
			),
		]);
	} catch (error) {
		console.error("Cleanup failed:", error);
	}
};

const handleSignal = async (signal, proLinkNetwork) => {
	console.log(`Received ${signal} signal, cleaning up...`);
	await disconnectFromProlinkNetwork(proLinkNetwork);
	console.log("Cleanup successful");
	process.exit();
};

const connectToProlinkNetwork = async () => {
	console.log("Bringing the ProLink network online...");
	const proLinkNetwork = await bringOnline();

	console.log("Automatically configuring the ProLink network...");
	await proLinkNetwork.autoconfigFromPeers();

	console.log("Connecting to the ProLink network...");
	proLinkNetwork.connect();

	if (!proLinkNetwork.isConnected()) {
		console.error("Failed to connect to the ProLink network");
		return;
	} else {
		console.log("Successfully connected to the ProLink network");
	}

	// Listen for other devices appearing on the network
	const connectedDevices = {};
	proLinkNetwork.deviceManager.on("connected", (device) => {
		if (!(device.id in connectedDevices)) {
			const { id, name } = device;
			console.log(`Device ID ${id} found on ProLink network (${name})`);
			connectedDevices[device.id] = device;
		}
	});

	return proLinkNetwork;
};

const deviceStates = {
	3: { state: undefined },
	4: { state: undefined },
	1: { state: undefined },
	2: { state: undefined },
};

const startListener = (proLinkNetwork) => {
	const mixProcessor = new MixstatusProcessor({
		mode: MixstatusMode.FollowsMaster,
	});

	proLinkNetwork.statusEmitter.on("status", (state) => {
		const { deviceId, trackId } = state;
		if (
			deviceStates[deviceId].state === undefined ||
			deviceStates[deviceId].state.trackId !== trackId
		) {
			deviceStates[deviceId].state = state;
			if (trackId !== 0) {
				console.log("New track ID: ", trackId);
				getTrack(proLinkNetwork, state);
			}
		}
		mixProcessor.handleState(state);
	});
	// Listen for "now playing" changes and send track data to the UI
	mixProcessor.on("nowPlaying", async (state) => {
		const track = await getTrack(proLinkNetwork, state);
		const artwork = await getArtwork(proLinkNetwork, state, track);
		sendMetadataToUi(track, artwork);
	});
	console.log("Now listening to the ProLink network");
};

const getTrack = async (proLinkNetwork, state) => {
	const { trackDeviceId, trackSlot, trackType, trackId } = state;
	const track = await proLinkNetwork.db.getMetadata({
		deviceId: trackDeviceId,
		trackId,
		trackType,
		trackSlot,
	});
	if (track.label?.name) {
		track.label.name = track.label.name.replace(/\[no label\]/g, "no label");
	} else {
		track.label = { name: "unknown label" };
	}
	console.log(
		`Player ${state.deviceId}: ${track.artist.name} - ${track.title} [${track.label.name}]`
	);
	return track;
};

const getArtwork = async (proLinkNetwork, state, track) => {
	const [proLinkArtwork, musicBrainzArtwork] = await Promise.all([
		getProLinkArtwork(proLinkNetwork, state, track),
		getMusicBrainzArtwork(track),
	]);
	if (musicBrainzArtwork) {
		console.log("Using MusicBrainz artwork");
		return musicBrainzArtwork;
	} else {
		console.log("Using local artwork");
		return proLinkArtwork;
	}
};

const getProLinkArtwork = async (proLinkNetwork, state, track) => {
	const { trackDeviceId, trackSlot, trackType } = state;
	// Append "_m" to filename to get higher resolution artwork
	// https://deep-symmetry.zulipchat.com/#narrow/stream/275855-dysentery-.26-crate-digger/topic/High.20res.20album.20art/near/289004764
	track.artwork.path = track.artwork.path.replace(".jpg", "_m.jpg");
	// Get artwork from the databse. This is returned as a Buffer object
	const buffer = await proLinkNetwork.db.getArtwork({
		deviceId: trackDeviceId,
		trackType,
		trackSlot,
		track,
	});
	if (buffer) {
		// Convert Buffer to a base64 string for use in an <img> element in the UI
		const base64Image = `data:image/jpeg;base64,${buffer.toString("base64")}`;
		return base64Image;
	}
	return null;
};

const sendMetadataToUi = (track, artwork) => {
	const metadata = { track, artwork };
	if (websocket?.readyState === WebSocket.OPEN) {
		websocket.send(JSON.stringify(metadata));
	}
};
