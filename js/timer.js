/**
 * 
 * @param {number} time_span milliseconds.
 * @param {TimerHandler} callback TImerHandler.
 * @returns 
 */
const Timer = (time_span, callback) => {
    let start_time, timer, is_running = false;

    function Time() { return Date.now() - start_time; }

    function Start() {
        if (is_running) return;
        start_time = Date.now();
        is_running = true;
        timer = setInterval(callback, time_span);
    }

    function Stop() {
        if (!is_running) return;
        is_running = false;
        clearInterval(timer);
    }

    function ReStart() {
        start_time = Date.now();
        if (!is_running)
            timer = setInterval(callback, time_span);
        is_running = true;
    }

    return {
        Time,
        Start,
        Stop,
        ReStart
    }
}