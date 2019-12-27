let myMap;
let listReviews = [];
let geoObjects = [];
let glob = {
    address: '',
    coordinates: [],
    review: '',
    name: '',
    place: '',
    date: ''
};
let isClickedOnBalloon = false;
let currentBalloon = null;

new Promise(resolve => ymaps.ready(resolve)
    .then(() => {
        myMap = new ymaps.Map('map', {
            center: [59.94, 30.32],
            zoom: 17,
            controls: ['zoomControl', 'searchControl'],
            behaviors: ['drag']
        });

        listReviews = getFromLocalStorage();

        if (listReviews.length > 0) {
            renderMarks(listReviews, myMap);
        }
        myMap.events.add('click', event => {
            const position = event.get('position');
            const coordinates = event.get('coords');

            glob.coordinates = [coordinates[0], coordinates[1]];

            geocodeBack(coordinates)
                .then((str) => {
                    glob.address = str;

                    renderPopup(position);

                    document.addEventListener('keyup', event => {
                        const popup = document.querySelector('.popup__container');

                        if (popup && event.keyCode === 27) {
                            event.preventDefault();
                            popup.innerHTML = '';
                        }
                    });
                });
        });
    })
);

//загрузка данных из localStorage

function getFromLocalStorage() {
    let arr = JSON.parse(localStorage.getItem('listReviews'));

    if (!arr) {
        return [];
    }
    return arr;
}

//рендер меток на карте

function renderMarks(array, map) {
    let customItemContentLayout = ymaps.templateLayoutFactory.createClass(
        `
        <div class='balloon'>
            <h2 class='balloon__header'>{{ properties.balloonContentHeader|raw }}</h2>
            <a href='#' class='balloon__link'>{{ properties.balloonContentBody|raw }}</a>
            <div class='balloon__review'>{{ properties.myBaloonReview|raw }}</div>
            <div class='balloon__footer'>{{ properties.balloonContentFooter|raw }}</div>
        </div>
        `
    );
    let clusterer = new ymaps.Clusterer({
        clusterIcons: [{
            href: 'images/group.png',
            size: [107, 79],
            offset: [-81, -79]
        }],
        clusterDisableClickZoom: true,
        clusterOpenBalloonOnClick: true,
        clusterBalloonContentLayout: 'cluster#balloonCarousel',
        clusterBalloonItemContentLayout: customItemContentLayout,
        clusterBalloonPanelMaxMapArea: 0,
        clusterBalloonContentLayoutWidth: 270,
        clusterBalloonContentLayoutHeight: 200,
        clusterBalloonPagerSize: 5,
        clusterIconContentLayout: ymaps.templateLayoutFactory.createClass(
            `
                <div class='cluster__text'>
                    {{ properties.geoObjects.length }}
                </div>
                `
        )
    });

    if (geoObjects.length > 0) {
        map.geoObjects.removeAll();
    }
    geoObjects = [];

    for (let i = 0; i < array.length; i++) {
        geoObjects.push(new ymaps.Placemark(
            [
                array[i].coordinates[0],
                array[i].coordinates[1]
            ], {
                balloonContentHeader: array[i].place,
                balloonContentBody: array[i].address,
                balloonContentFooter: array[i].date,
                myBaloonReview: array[i].review
            }, {
                iconLayout: 'default#image',
                iconImageHref: 'images/sprite.png',
                iconImageSize: [44, 66],
                iconImageOffset: [-22, -66],
                iconImageClipRect: [
                    [10, 10],
                    [54, 76]
                ],
                hasBalloon: false
            }));
    }

    geoObjects.forEach(obj => {
        obj.events.add('mouseenter', event => {
                let geoObject = event.get('target');

                geoObject.options.set({
                    iconImageClipRect: [
                        [74, 10],
                        [118, 76]
                    ]
                });
            })
            .add('mouseleave', event => {
                event.get('target').options.set({
                    iconImageClipRect: [
                        [10, 10],
                        [54, 76]
                    ]
                });
            })
            .add('click', event => {
                let geoObject = event.get('target');

                glob.coordinates = geoObject.geometry.getCoordinates();

                geocodeBack(glob.coordinates).then((str) => {
                    glob.address = str;

                    renderPopup(
                        [
                            event.originalEvent.domEvent.originalEvent.clientX,
                            event.originalEvent.domEvent.originalEvent.clientY
                        ]
                    );
                });
            });
    });

    clusterer.add(geoObjects);
    map.geoObjects.add(clusterer);

    clusterer.events.add('balloonopen', event => {

        let balloon = clusterer.balloon;
        let geoBojectsInCluster = event.get('target').getData().cluster.getGeoObjects();

        glob.coordinates = geoBojectsInCluster[0].geometry.getCoordinates();

        geocodeBack(glob.coordinates).then((str) => {
            glob.address = str;

            balloon.events.add('click', () => {
                isClickedOnBalloon = true;
                currentBalloon = balloon;
            });
        })
    });
}

//рендер попапа

function renderPopup(position) {
    const WIDTH = 380;
    const HEIGHT = 555;
    const html = generateTemplate();
    const popup = document.querySelector('.popup');
    let [x, y] = position;

    if ((x + WIDTH) > document.body.clientWidth) {
        x -= WIDTH;
        if (x < 0) {
            x = 0;
        }
    }
    if ((y + WIDTH) > document.body.clientWidth) {
        y -= WIDTH;
        if (y < 0) {
            y = 0;
        }
    }
    popup.style = `
        top: ${y}px;
        left: ${x}px;
    `;
    popup.innerHTML = html;

    renderCurrentReviewsInPopup(popup);
}
// рендер попапа + добавление обработчика на кнопку "добавить"
function renderCurrentReviewsInPopup(popup) {
    const html = generateTemplate();

    popup.innerHTML = html;

    const popupButton = popup.querySelector('.form__button');

    popupButton.addEventListener('click', () => {
        clickHandlerPopupButton(popup);
    });

    const popupCloseButton = popup.querySelector('.popup__close');

    popupCloseButton.addEventListener('click', event => {
        event.preventDefault();
        popup.innerHTML = '';
    });
}

//генерация шаблона попапа по координатам

function generateTemplate() {
    const currentReviews = {
        items: []
    };
    const address = glob.address;
    let isFound = false;

    for (const item of listReviews) {
        if (item.coordinates[0] === glob.coordinates[0] && item.coordinates[1] === glob.coordinates[1]) {
            isFound = true;
            currentReviews.items.push(item);
        }
    }
    const popupTemplate = document.querySelector('#popup-template').textContent;
    const render = Handlebars.compile(popupTemplate);

    return render({ address, isFound, ...currentReviews });
}

//обработчик кликов на кнопке  "Добавить"

function clickHandlerPopupButton(popup) {
    const formReview = document.forms.formreview;

    const reviewName = formReview.reviewName;
    const reviewPlace = formReview.reviewPlace;
    const reviewImpressions = formReview.reviewImpressions;



    if (validateInputs([reviewName, reviewPlace, reviewImpressions])) {
        addInformation({ reviewName, reviewPlace, reviewImpressions });
        ymaps.ready(renderMarks(listReviews, myMap));
        renderCurrentReviewsInPopup(popup);

        saveToLocalStorage(listReviews);
    }
}

document.addEventListener('click', event => {
    if (event.target.classList.contains('balloon__link') && isClickedOnBalloon) {
        renderPopupFromBalloon(event, currentBalloon);
        isClickedOnBalloon = false;
    }
});

//рендер попапа по координатам балуна

function renderPopupFromBalloon(event, ballon) {
    currentBalloon.close();

    renderPopup([event.clientX, event.clientY]);
}

// функция обратного геокодирования (координаты -> адрес)
async function geocodeBack(coords) {
    let result = await ymaps.geocode(coords);
    let addr = result.geoObjects.get(0).getAddressLine().split(', ').reverse();

    // добавляем префикс 'д.' к номеру дома
    if (/^[\d]/g.test(addr[0])) {
        addr.splice(0, 1, 'д. ' + addr[0]);
    }

    addr.length--; // убираем название страны (см. макет)

    return addr.join(', ');
}

//сохранение данных в localStorage

function saveToLocalStorage(arr) {
    localStorage.setItem('listReviews', JSON.stringify(arr));
}

//добваление инвормации в основнйо массив

function addInformation({ reviewName, reviewPlace, reviewImpressions }) {
    glob = {
        ...glob,
        name: reviewName.value,
        place: reviewPlace.value,
        date: getCurrentDateTime(),
        review: reviewImpressions.value,
    };

    listReviews.push({...glob });
}

//валидация введенных данных

function validateInputs(inputArray) {
    let isEmpty = false;

    // переберем все инпуты и проверим не пустые ли они
    for (const input of inputArray) {
        if (!input.value) {
            if (!input.classList.contains('fail')) {
                input.classList.add('fail');
            }
            isEmpty = false;
        } else {
            if (input.classList.contains('fail')) {
                input.classList.remove('fail');
            }
            isEmpty = true;
        }
    }

    return isEmpty;
}

// текущуя дата в формате стр.
function getCurrentDateTime() {
    let currDate = new Date(),

        month = currDate.getMonth() + 1,
        day = currDate.getDate(),
        hours = currDate.getHours(),
        minutes = currDate.getMinutes(),
        seconds = currDate.getSeconds();

    month = (month < 10) ? ('0' + month) : ('' + month);
    day = (day < 10) ? ('0' + day) : ('' + day);
    hours = (hours < 10) ? ('0' + hours) : ('' + hours);
    minutes = (minutes < 10) ? ('0' + minutes) : ('' + minutes);
    seconds = (seconds < 10) ? ('0' + seconds) : ('' + seconds);

    return `${currDate.getFullYear()}.${month}.${day} ${hours}:${minutes}:${seconds}`;
}