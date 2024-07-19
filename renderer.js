document.addEventListener('DOMContentLoaded', () => {
    const launchButton = document.getElementById('launchButton');
    const statusMessage = document.getElementById('statusMessage');
    const progressBar = document.getElementById('progressBar');
    const settingsModal = document.getElementById('settingsModal');
    const ramSlider = document.getElementById('ramSlider');
    const ramValue = document.getElementById('ramValue');
    const saveSettings = document.getElementById('saveSettings');

    // Check if elements exist before trying to use them
    const settingsIcon = document.querySelector('.nav-button:nth-child(2)');
    const closeBtn = settingsModal ? settingsModal.querySelector('.close') : null;

    let maxRam = '6G';

    async function fetchHypixelPlayerCount() {
        try {
            const count = await window.electronAPI.getHypixelCount();
            const playerCountElement = document.getElementById('playerCount');
            if (playerCountElement) {
                playerCountElement.textContent = count.toLocaleString();
            }
        } catch (error) {
            console.error('Error fetching Hypixel player count:', error);
            const playerCountElement = document.getElementById('playerCount');
            if (playerCountElement) {
                playerCountElement.textContent = 'Error';
            }
        }
    }

    fetchHypixelPlayerCount();
    setInterval(fetchHypixelPlayerCount, 5 * 60 * 1000);

    if (launchButton) {
        launchButton.addEventListener('click', async () => {
            launchButton.disabled = true;
            if (statusMessage) statusMessage.textContent = 'Preparing to launch Minecraft...';
            if (progressBar) progressBar.style.width = '0%';
            await window.electronAPI.downloadFiles();

            try {
                await window.electronAPI.launchMinecraft({
                    version: {
                        number: "1.21",
                        type: "release",
						custom: "fabric"
						
                    },
                    quickPlay: {
                        type: "multiplayer",
                        identifier: "hypixel.net"
                    },
                        memory: {
                        max: maxRam,
                        min: "2G"
                    }
                });
                if (statusMessage) statusMessage.textContent = 'Minecraft is running';
                if (progressBar) progressBar.style.width = '100%';
            } catch (err) {
                if (statusMessage) statusMessage.textContent = 'Failed to launch Minecraft';
                console.error(err);
                launchButton.disabled = false;
            }
        });
    }

    if (settingsIcon) {
        settingsIcon.onclick = () => {
            if (settingsModal) settingsModal.style.display = 'block';
        };
    }

    if (closeBtn) {
        closeBtn.onclick = () => {
            if (settingsModal) settingsModal.style.display = 'none';
        };
    }

    window.onclick = (event) => {
        if (event.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    };

    if (ramSlider && ramValue) {
        ramSlider.oninput = function() {
            ramValue.textContent = `${this.value} GB`;
        };
    }

    if (saveSettings) {
        saveSettings.onclick = () => {
            if (ramSlider) maxRam = `${ramSlider.value}G`;
            if (settingsModal) settingsModal.style.display = 'none';
        };
    }

    // Listen for progress updates from the main process
    window.electronAPI.onLaunchProgress((event, progress) => {
        const { type, task, total } = progress;
        if (type === "classes" || type === "assets" || type === "classes-custom") {
            const percent = (task / total) * 100;
            if (statusMessage) statusMessage.textContent = `${type}: ${task}/${total}`;
            if (progressBar) progressBar.style.width = `${percent}%`;
        } else {
            console.log("Invalid progress data:", progress);
        }
    });

    // Listen for launch completion
    window.electronAPI.onLaunchComplete(() => {
        if (statusMessage) statusMessage.textContent = "Minecraft is running";
        if (progressBar) progressBar.style.width = "100%";
    });

    // Listen for launch errors
    window.electronAPI.onLaunchError((event, error) => {
        if (statusMessage) statusMessage.textContent = `Error: ${error.message}`;
        console.error(error);
        if (launchButton) launchButton.disabled = false;
    });

    // Listen for Minecraft exit
    window.electronAPI.onMinecraftExit(() => {
        if (statusMessage) statusMessage.textContent = "Minecraft has exited";
        if (launchButton) launchButton.disabled = false;
    });
});