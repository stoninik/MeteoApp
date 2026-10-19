window.addEventListener('DOMContentLoaded', () => {
    
    // 1. ИНИЦИАЛИЗАЦИЯ НА КАРТАТА (Центрирана над Южното Черноморие)
    const map = L.map('map').setView([42.42, 27.75], 10); 

    // НОВ СТАБИЛЕН ДОСТАВЧИК: Използваме CartoDB сървър, който не блокира локални заявки
    L.tileLayer('https://{s}://{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap, © CartoDB'
    }).addTo(map);

    // Точка на брега (Созопол - Плаж Харманите)
    const targetLocation = { name: "Созопол (Бряг)", lat: 42.416, lon: 27.697 };

    // Маркер за Созопол
    L.marker([targetLocation.lat, targetLocation.lon]).addTo(map)
        .bindPopup(`<b>${targetLocation.name}</b><br>Точка за изчисление на брега.`).openPopup();

    // 2. СИМУЛИРАНИ ДАННИ ОТ КОРАБИ И БУЙОВЕ В МОРЕТО
    const shipsAndBuoys = [
        { name: "Търговски кораб 'Burgas Cargo'", lat: 42.48, lon: 27.62, windSpeed: 14.5, type: "Кораб" },
        { name: "Контейнеровоз 'Black Sea Star'", lat: 42.52, lon: 27.91, windSpeed: 18.2, type: "Кораб" },
        { name: "Метеорологичен Буй №3", lat: 42.31, lon: 27.82, windSpeed: 11.0, type: "Буй" },
        { name: "Пътнически съд 'Sea Comet'", lat: 42.25, lon: 27.78, windSpeed: 9.5, type: "Кораб" }
    ];

    // Поставяне на корабите и буйовете на картата
    shipsAndBuoys.forEach(data => {
        L.marker([data.lat, data.lon]).addTo(map)
            .bindPopup(`<b>${data.name}</b><br>Тип: ${data.type}<br>Измерен вятър: ${data.windSpeed} възела`);
    });

    // 3. МАТЕМАТИЧЕСКИ МОДЕЛ 1: IDW ИНТЕРПОЛАЦИЯ ЗА МОМЕНТНА СТОЙНОСТ
    function getHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Радиус на Земята в км
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    function calculateIdwWind(targetLat, targetLon, stations) {
        let totalWeight = 0;
        let weightedSum = 0;

        stations.forEach(station => {
            let dist = getHaversineDistance(targetLat, targetLon, station.lat, station.lon);
            if (dist < 0.2) return station.windSpeed; 

            let weight = 1 / (dist * dist); 
            totalWeight += weight;
            weightedSum += (station.windSpeed * weight);
        });

        return totalWeight === 0 ? 0 : weightedSum / totalWeight;
    }

    // Изчисляваме и показваме моментната стойност на екрана
    const currentWindAtShore = calculateIdwWind(targetLocation.lat, targetLocation.lon, shipsAndBuoys);
    document.getElementById('current-wind').innerText = currentWindAtShore.toFixed(1) + " възела";

    // 4. МАТЕМАТИЧЕСКИ МОДЕЛ 2: ЛИНЕЙНА РЕГРЕСИЯ ЗА ПРОГНОЗА
    const historicalTrend = [
        { time: -3, val: 9.2 },  
        { time: -2, val: 11.5 }, 
        { time: -1, val: 12.8 }, 
        { time: 0, val: currentWindAtShore }  
    ];

    function predictFutureTrend(history, hourAhead) {
        let n = history.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        
        history.forEach(p => {
            sumX += p.time;
            sumY += p.val;
            sumXY += p.time * p.val;
            sumXX += p.time * p.time;
        });

        let slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        let intercept = (sumY - slope * sumX) / n;

        let prediction = slope * hourAhead + intercept;
        return prediction < 0 ? 0 : prediction; 
    }

    // Генерираме масив с прогноза за следващите 10 часа
    let labelsX = ['Сега'];
    let forecastData = [parseFloat(currentWindAtShore.toFixed(1))];

    for (let h = 1; h <= 10; h++) {
        labelsX.push("+" + h + " ч.");
        let futureVal = predictFutureTrend(historicalTrend, h);
        forecastData.push(parseFloat(futureVal.toFixed(1)));
    }

    // 5. ИЗЧЕРТАВАНЕ НА ГРАФИКАТА С CHART.JS
    const ctx = document.getElementById('forecastChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labelsX,
            datasets: [{
                label: 'Прогнозирана скорост на вятъра (възела)',
                data: forecastData,
                borderColor: '#3182ce',
                backgroundColor: 'rgba(49, 130, 206, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Възела (knots)' }
                }
            }
        }
    });
});
