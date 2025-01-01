import { MusicBrainzApi, CoverArtArchiveApi } from "musicbrainz-api";

const mbApi = new MusicBrainzApi({
	appName: "now-playing",
	appVersion: "0.1.0",
	appContactInfo: "now-playing@now-playing.com",
});

const coverArtArchiveApiClient = new CoverArtArchiveApi();

export const getMusicBrainzArtwork = async (track) => {
	const releaseMbid = await findMusicbrainzRelease(track);
	if (releaseMbid) {
		const base64Image = await findMusicBrainzArtwork(releaseMbid);
		return base64Image;
	}
	return null;
};

const findMusicbrainzRelease = async (track) => {
	const artist = track.artist.name;
	const title = track.title;
	try {
		console.log(
			`Looking for MusicBrainz recording for ${artist} - ${title}...`
		);
		const result = await mbApi.search("recording", {
			query: { artist, recording: title, primarytype: "Single" },
		});
		if (result.recordings.length) {
			console.log(
				"Found recording. Getting best guess release for this track..."
			);
			const releaseMbid = result.recordings[0].releases[0].id;
			console.log(`Using release ${releaseMbid}`);
			return releaseMbid;
		}
	} catch (error) {
		console.error(`Error getting MusicBrainz info: ${error}`);
	}
	console.log("No MusicBrainz entry found");
	return null;
};

const findMusicBrainzArtwork = async (releaseMbid) => {
	try {
		console.log(`Searching artwork for MusicBrainz release ${releaseMbid}...`);
		const covers = await coverArtArchiveApiClient.getReleaseCovers(releaseMbid);
		if (covers.images.length) {
			console.log("Artwork found");
			const image = covers.images[0].image;
			const base64Image = await downloadAndEncodeImage(image);
			return base64Image;
		}
	} catch (error) {
		console.log(`No artwork found for MusicBrainz release ${releaseMbid}`);
	}
	return null;
};

const downloadAndEncodeImage = async (url) => {
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error("Failed to fetch the image");

		// Retrieve the image as a Buffer
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Convert the Buffer into a Base64 string
		const base64Image = `data:image/jpeg;base64,${buffer.toString("base64")}`;
		return base64Image;
	} catch (error) {
		console.error("Error:", error.message);
	}
	return null;
};
