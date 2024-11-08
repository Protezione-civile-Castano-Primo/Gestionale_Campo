document.addEventListener('DOMContentLoaded', function() {
    const content = document.querySelector('.content');
    const increaseFontBtn = document.getElementById('increase-font');
    const decreaseFontBtn = document.getElementById('decrease-font');

    let currentFontSize = 16;

    function updateFontSize(size) {
        content.style.fontSize = size + 'px';
    }

    increaseFontBtn.addEventListener('click', function() {
        if (currentFontSize < 24) {
            currentFontSize += 2;
            updateFontSize(currentFontSize);
        }
    });

    decreaseFontBtn.addEventListener('click', function() {
        if (currentFontSize > 12) {
            currentFontSize -= 2;
            updateFontSize(currentFontSize);
        }
    });
});