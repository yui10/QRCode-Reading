const LANG = {
    JA: "ja",
    EN: "en",

}

const country_code = () => {
    async function fetchCountryCode(lang = LANG.JA) {
        if (!Object.values(LANG).includes(lang)) throw new Error("Invalid language code");
        url = "https://cdn.jsdelivr.net/npm/world_countries_lists@latest/data/countries/" + lang + "/countries.json";
        const res = await fetch(url, { mode: 'cors' });
        const json = await res.json();
        return json;
    }

    function fetchCountryList(lang = LANG.JA) {
        let country_list = [];
        const json_res = fetchCountryCode(lang).then(json => {
            json.flat().forEach(element => {
                country_list.push(element);
            });
        });
        return country_list;
    }

    return { fetchCountryList };
}
