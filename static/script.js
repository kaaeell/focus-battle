document.getElementById('start-btn').addEventListener('click', function() {
    let timer = document.getElementById('timer');
    let totalSeconds = 25 * 60; // 25 minutes
    let interval = setInterval(function() {
        let minutes = Math.floor(totalSeconds / 60);
        let seconds = totalSeconds % 60;
        timer.textContent = `${minutes}:${seconds < 10 ? '0'+seconds : seconds}`;
        totalSeconds--;
        if(totalSeconds < 0) {
            clearInterval(interval);
            alert('Session Complete! XP Gained!');
        }
    }, 1000);
});