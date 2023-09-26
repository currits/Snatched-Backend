/*
    NOT OUR CODE
    Cute little function for parsing google response into a pretty address object
    Sourced from https://medium.com/@almestaadmicadiab/how-to-parse-google-maps-address-components-geocoder-response-774d1f3375d
*/
function getAddressObject(address_components) {
    // Object for what address component type 'should be' reassigned as
    var ShouldBeComponent = {
        street_no: ["street_number"],
        postcode: ["postal_code"],
        street: ["street_address", "route"],
        region: [
            "administrative_area_level_1",
            "administrative_area_level_2",
            "administrative_area_level_3",
            "administrative_area_level_4",
            "administrative_area_level_5"
        ],
        city: [
            "locality",
            "sublocality",
            "sublocality_level_1",
            "sublocality_level_2",
            "sublocality_level_3",
            "sublocality_level_4"
        ],
        country: ["country"]
    };

    // Returned object
    var address = {
        street_no: "",
        postcode: "",
        street: "",
        region: "",
        city: "",
        country: ""
    };

    // For each address component, reassign its corresponding 'should be' attribute value to the new address object
    address_components.forEach(component => {
        for (var shouldBe in ShouldBeComponent) {
            if (ShouldBeComponent[shouldBe].indexOf(component.types[0]) !== -1) {
                if (shouldBe === "country") {
                    address[shouldBe] = component.short_name;
                } else {
                    address[shouldBe] = component.long_name;
                }
            }
        }
    });

    return address;
}

module.exports = {
    getAddressObject: getAddressObject
}