const fs = require("node:fs");
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const https = require("node:https");
const { Client, Authenticator } = require("minecraft-launcher-core");
const { Auth } = require("msmc");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const AdmZip = require("adm-zip");
const os = require("node:os");

const AWS_ENDPOINT = "https://fra1.digitaloceanspaces.com";
const AWS_ACCESS_KEY_ID = "DO00HRVV28TYP6PTYTYT";
const AWS_SECRET_ACCESS_KEY = "NP4v3RNpoedrKIBNb3nXoL5I6uJrHb6ZyqQtF7d2CH0";

const s3 = new S3Client({
	endpoint: AWS_ENDPOINT,
	region: "fra1",
	credentials: {
		accessKeyId: AWS_ACCESS_KEY_ID,
		secretAccessKey: AWS_SECRET_ACCESS_KEY,
	},
});

function getJREFileName() {
	const platform = process.platform;
	const arch = os.arch();
	console.log(`Detected platform: ${platform}, architecture: ${arch}`);
	
	switch (platform) {
		case "darwin":
			if (arch === 'arm64') {
				console.log("Using ARM-specific JRE for macOS");
				return "jdk-21.0.3+9-jre-mac-arm.zip"; // Use the ARM-specific JRE
			}
			console.log("Using Intel-specific JRE for macOS");
			return "jdk-21.0.3+9-jre-mac.zip"; // Use the regular JRE for Intel
		case "win32":
			console.log("Using JRE for Windows");
			return "jdk-21.0.3+9-jre-windows.zip";
		default:
			throw new Error("Unsupported platform");
	}
}

async function downloadFilesFromS3(bucketName, key, destination) {
	const params = {
		Bucket: bucketName,
		Key: key,
	};
	try {
		const command = new GetObjectCommand(params);
		const response = await s3.send(command);
		const data = await streamToBuffer(response.Body);
		fs.writeFileSync(destination, data);
		console.log("File downloaded successfully.");
	} catch (error) {
		console.error("Error downloading file from S3:", error);
		throw error;
	}
}

const streamToBuffer = (stream) =>
	new Promise((resolve, reject) => {
		const chunks = [];
		stream.on("data", (chunk) => chunks.push(chunk));
		stream.on("end", () => resolve(Buffer.concat(chunks)));
		stream.on("error", reject);
	});

function extractZip(source, destination) {
	const zip = new AdmZip(source);
	if (!fs.existsSync(destination)) {
		fs.mkdirSync(destination, { recursive: true });
	}
	zip.extractAllTo(destination, true);
	console.log("File extracted successfully to:", destination);

	if (process.platform === "darwin" || process.platform === "linux") {
		const javaBinaryPath = path.join(destination, "bin", "java");
		fs.chmodSync(javaBinaryPath, "755");
		console.log(`Set executable permissions for ${javaBinaryPath}`);
	}
}

let mainWindow;
const launcher = new Client();

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		minWidth: 800,
		minHeight: 600,
		frame: false,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, "preload.js"),
			contentSecurityPolicy:
				"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com",
		},
	});

	mainWindow.loadFile("index.html");
	mainWindow.maximize();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

ipcMain.handle("get-hypixel-count", async () => {
	return new Promise((resolve, reject) => {
		https
			.get("https://api.mcsrvstat.us/2/hypixel.net", (resp) => {
				let data = "";
				resp.on("data", (chunk) => {
					data += chunk;
				});
				resp.on("end", () => {
					try {
						const jsonData = JSON.parse(data);
						resolve(jsonData.players.online);
					} catch (e) {
						reject(e);
					}
				});
			})
			.on("error", (err) => {
				reject(err);
			});
	});
});

ipcMain.handle("download-files", async (event, opts) => {
	console.log("Checking for Java...");
    //chaning state of progress bar
	mainWindow.webContents.send("launch-progress", 0);

	const javaPath = path.join(__dirname, "java");

	if (fs.existsSync(javaPath)) {
		console.log("Java folder already exists. Skipping download.");
		return { success: true, message: "Java already installed" };
	}

	console.log("Downloading JRE...");

	mainWindow.webContents.send("launch-progress", 10);

	try {
		const jreFileName = getJREFileName();
		const downloadPath = path.join(__dirname, jreFileName);
		await downloadFilesFromS3("racoonlauncher", jreFileName, downloadPath);

		console.log("Extracting JRE...");
		extractZip(downloadPath, javaPath); // Extract to javaPath instead of __dirname

		fs.unlinkSync(downloadPath);

		return {
			success: true,
			message: "JRE downloaded and extracted successfully",
		};
	} catch (error) {
		console.error("Error:", error);
		return {
			success: false,
			message: "Error occurred during download or extraction",
		};
	}
    
});

ipcMain.handle("launch-minecraft", async (event, opts) => {
	const authManager = new Auth("select_account");
	const xboxManager = await authManager.launch("raw");
	const token = await xboxManager.getMinecraft();
	const options = {
		...opts,
		authorization: token.mclc(),
		root: "./minecraft",
		javaPath: path.join(__dirname, "java", "bin", "java"),
	};

	launcher.launch(options);

	launcher.on("progress", (e) => {
		mainWindow.webContents.send("launch-progress", e);
	});

	launcher.on("data", (e) => {
		console.log(e);
	});

	launcher.on("close", () => {
		mainWindow.webContents.send("minecraft-exit");
	});
});

launcher.on("debug", (e) => console.log(e));
launcher.on("data", (e) => console.log(e));

ipcMain.on("minimize-window", () => {
	mainWindow.minimize();
});

ipcMain.on("maximize-window", () => {
	if (mainWindow.isMaximized()) {
		mainWindow.unmaximize();
	} else {
		mainWindow.maximize();
	}
});

ipcMain.on("close-window", () => {
	mainWindow.close();
});
