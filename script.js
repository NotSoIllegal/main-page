function updateAltaiTime() {
    const timeElement = document.querySelector('.time-value');

    if (!timeElement) return;

    const now = new Date();
    const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Barnaul' }));

    const hours = String(moscowTime.getHours()).padStart(2, '0');
    const minutes = String(moscowTime.getMinutes()).padStart(2, '0');
    const seconds = String(moscowTime.getSeconds()).padStart(2, '0');

    timeElement.textContent = `${hours}:${minutes}:${seconds}`;
}

updateAltaiTime();
setInterval(updateAltaiTime, 1000);
