/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function (knex) {
  // Deletes ALL existing entries
  await knex('destinations').del()
  await knex('destinations').insert([
    {
      id: 1,
      place: 'Afghanistan'
  },
  {
      id: 2,
      place: 'Albania'
  },
  {
      id: 3,
      place: 'Algeria'
  },
  {
      id: 4,
      place: 'Andorra'
  },
  {
      id: 5,
      place: 'Angola'
  },
  {
      id: 6,
      place: 'Antigua and Barbuda'
  },
  {
      id: 7,
      place: 'Argentina'
  },
  {
      id: 8,
      place: 'Armenia'
  },
  {
      id: 9,
      place: 'Australia'
  },
  {
      id: 10,
      place: 'Austria'
  },
  {
      id: 11,
      place: 'Azerbaijan'
  },
  {
      id: 12,
      place: 'Bahamas'
  },
  {
      id: 13,
      place: 'Bahrain'
  },
  {
      id: 14,
      place: 'Bangladesh'
  },
  {
      id: 15,
      place: 'Barbados'
  },
  {
      id: 16,
      place: 'Belarus'
  },
  {
      id: 17,
      place: 'Belgium'
  },
  {
      id: 18,
      place: 'Belize'
  },
  {
      id: 19,
      place: 'Benin'
  },
  {
      id: 20,
      place: 'Bhutan'
  },
  {
      id: 21,
      place: 'Bolivia'
  },
  {
      id: 22,
      place: 'Bosnia and Herzegovina'
  },
  {
      id: 23,
      place: 'Botswana'
  },
  {
      id: 24,
      place: 'Brazil'
  },
  {
      id: 25,
      place: 'Brunei'
  },
  {
      id: 26,
      place: 'Bulgaria'
  },
  {
      id: 27,
      place: 'Burkina Faso'
  },
  {
      id: 28,
      place: 'Burundi'
  },
  {
      id: 29,
      place: 'Cabo Verde'
  },
  {
      id: 30,
      place: 'Cambodia'
  },
  {
      id: 31,
      place: 'Cameroon'
  },
  {
      id: 32,
      place: 'Canada'
  },
  {
      id: 33,
      place: 'Central African Republic'
  },
  {
      id: 34,
      place: 'Chad'
  },
  {
      id: 35,
      place: 'Chile'
  },
  {
      id: 36,
      place: 'China'
  },
  {
      id: 37,
      place: 'Colombia'
  },
  {
      id: 38,
      place: 'Comoros'
  },
  {
      id: 39,
      place: 'Congo, Democratic Republic of the'
  },
  {
      id: 40,
      place: 'Congo, Republic of the'
  },
  {
      id: 41,
      place: 'Costa Rica'
  },
  {
      id: 42,
      place: 'Côte d\'Ivoire'
  },
  {
      id: 43,
      place: 'Croatia'
  },
  {
      id: 44,
      place: 'Cuba'
  },
  {
      id: 45,
      place: 'Cyprus'
  },
  {
      id: 46,
      place: 'Czech Republic'
  },
  {
      id: 47,
      place: 'Denmark'
  },
  {
      id: 48,
      place: 'Djibouti'
  },
  {
      id: 49,
      place: 'Dominica'
  },
  {
      id: 50,
      place: 'Dominican Republic'
  },
  {
      id: 51,
      place: 'Ecuador'
  },
  {
      id: 52,
      place: 'Egypt'
  },
  {
      id: 53,
      place: 'El Salvador'
  },
  {
      id: 54,
      place: 'Equatorial Guinea'
  },
  {
      id: 55,
      place: 'Eritrea'
  },
  {
      id: 56,
      place: 'Estonia'
  },
  {
      id: 57,
      place: 'Eswatini (formerly Swaziland)'
  },
  {
      id: 58,
      place: 'Ethiopia'
  },
  {
      id: 59,
      place: 'Fiji'
  },
  {
      id: 60,
      place: 'Finland'
  },
  {
      id: 61,
      place: 'France'
  },
  {
      id: 62,
      place: 'Gabon'
  },
  {
      id: 63,
      place: 'Gambia'
  },
  {
      id: 64,
      place: 'Georgia'
  },
  {
      id: 65,
      place: 'Germany'
  },
  {
      id: 66,
      place: 'Ghana'
  },
  {
      id: 67,
      place: 'Greece'
  },
  {
      id: 68,
      place: 'Grenada'
  },
  {
      id: 69,
      place: 'Guatemala'
  },
  {
      id: 70,
      place: 'Guinea'
  },
  {
      id: 71,
      place: 'Guinea-Bissau'
  },
  {
      id: 72,
      place: 'Guyana'
  },
  {
      id: 73,
      place: 'Haiti'
  },
  {
      id: 74,
      place: 'Honduras'
  },
  {
      id: 75,
      place: 'Hungary'
  },
  {
      id: 76,
      place: 'Iceland'
  },
  {
      id: 77,
      place: 'India'
  },
  {
      id: 78,
      place: 'Indonesia'
  },
  {
      id: 79,
      place: 'Iran'
  },
  {
      id: 80,
      place: 'Iraq'
  },
  {
      id: 81,
      place: 'Ireland'
  },
  {
      id: 82,
      place: 'Israel'
  },
  {
      id: 83,
      place: 'Italy'
  },
  {
      id: 84,
      place: 'Jamaica'
  },
  {
      id: 85,
      place: 'Japan'
  },
  {
      id: 86,
      place: 'Jordan'
  },
  {
      id: 87,
      place: 'Kazakhstan'
  },
  {
      id: 88,
      place: 'Kenya'
  },
  {
      id: 89,
      place: 'Kiribati'
  },
  {
      id: 90,
      place: 'Korea, North'
  },
  {
      id: 91,
      place: 'Korea, South'
  },
  {
      id: 92,
      place: 'Kosovo'
  },
  {
      id: 93,
      place: 'Kuwait'
  },
  {
      id: 94,
      place: 'Kyrgyzstan'
  },
  {
      id: 95,
      place: 'Laos'
  },
  {
      id: 96,
      place: 'Latvia'
  },
  {
      id: 97,
      place: 'Lebanon'
  },
  {
      id: 98,
      place: 'Lesotho'
  },
  {
      id: 99,
      place: 'Liberia'
  },
  {
      id: 100,
      place: 'Libya'
  },
  {
      id: 101,
      place: 'Liechtenstein'
  },
  {
      id: 102,
      place: 'Lithuania'
  },
  {
      id: 103,
      place: 'Luxembourg'
  },
  {
      id: 104,
      place: 'Madagascar'
  },
  {
      id: 105,
      place: 'Malawi'
  },
  {
      id: 106,
      place: 'Malaysia'
  },
  {
      id: 107,
      place: 'Maldives'
  },
  {
      id: 108,
      place: 'Mali'
  },
  {
      id: 109,
      place: 'Malta'
  },
  {
      id: 110,
      place: 'Marshall Islands'
  },
  {
      id: 111,
      place: 'Mauritania'
  },
  {
      id: 112,
      place: 'Mauritius'
  },
  {
      id: 113,
      place: 'Mexico'
  },
  {
      id: 114,
      place: 'Micronesia'
  },
  {
      id: 115,
      place: 'Moldova'
  },
  {
      id: 116,
      place: 'Monaco'
  },
  {
      id: 117,
      place: 'Mongolia'
  },
  {
      id: 118,
      place: 'Montenegro'
  },
  {
      id: 119,
      place: 'Morocco'
  },
  {
      id: 120,
      place: 'Mozambique'
  },
  {
      id: 121,
      place: 'Myanmar (formerly Burma)'
  },
  {
      id: 122,
      place: 'Namibia'
  },
  {
      id: 123,
      place: 'Nauru'
  },
  {
      id: 124,
      place: 'Nepal'
  },
  {
      id: 125,
      place: 'Netherlands'
  },
  {
      id: 126,
      place: 'New Zealand'
  },
  {
      id: 127,
      place: 'Nicaragua'
  },
  {
      id: 128,
      place: 'Niger'
  },
  {
      id: 129,
      place: 'Nigeria'
  },
  {
      id: 130,
      place: 'North Macedonia (formerly Macedonia)'
  },
  {
      id: 131,
      place: 'Norway'
  },
  {
      id: 132,
      place: 'Oman'
  },
  {
      id: 133,
      place: 'Pakistan'
  },
  {
      id: 134,
      place: 'Palau'
  },
  {
      id: 135,
      place: 'Palestine'
  },
  {
      id: 136,
      place: 'Panama'
  },
  {
      id: 137,
      place: 'Papua New Guinea'
  },
  {
      id: 138,
      place: 'Paraguay'
  },
  {
      id: 139,
      place: 'Peru'
  },
  {
      id: 140,
      place: 'Philippines'
  },
  {
      id: 141,
      place: 'Poland'
  },
  {
      id: 142,
      place: 'Portugal'
  },
  {
      id: 143,
      place: 'Qatar'
  },
  {
      id: 144,
      place: 'Romania'
  },
  {
      id: 145,
      place: 'Russia'
  },
  {
      id: 146,
      place: 'Rwanda'
  },
  {
      id: 147,
      place: 'Saint Kitts and Nevis'
  },
  {
      id: 148,
      place: 'Saint Lucia'
  },
  {
      id: 149,
      place: 'Saint Vincent and the Grenadines'
  },
  {
      id: 150,
      place: 'Samoa'
  },
  {
      id: 151,
      place: 'San Marino'
  },
  {
      id: 152,
      place: 'Sao Tome and Principe'
  },
  {
      id: 153,
      place: 'Saudi Arabia'
  },
  {
      id: 154,
      place: 'Senegal'
  },
  {
      id: 155,
      place: 'Serbia'
  },
  {
      id: 156,
      place: 'Seychelles'
  },
  {
      id: 157,
      place: 'Sierra Leone'
  },
  {
      id: 158,
      place: 'Singapore'
  },
  {
      id: 159,
      place: 'Slovakia'
  },
  {
      id: 160,
      place: 'Slovenia'
  },
  {
      id: 161,
      place: 'Solomon Islands'
  },
  {
      id: 162,
      place: 'Somalia'
  },
  {
      id: 163,
      place: 'South Africa'
  },
  {
      id: 164,
      place: 'South Sudan'
  },
  {
      id: 165,
      place: 'Spain'
  },
  {
      id: 166,
      place: 'Sri Lanka'
  },
  {
      id: 167,
      place: 'Sudan'
  },
  {
      id: 168,
      place: 'Suriname'
  },
  {
      id: 169,
      place: 'Sweden'
  },
  {
      id: 170,
      place: 'Switzerland'
  },
  {
      id: 171,
      place: 'Syria'
  },
  {
      id: 172,
      place: 'Taiwan'
  },
  {
      id: 173,
      place: 'Tajikistan'
  },
  {
      id: 174,
      place: 'Tanzania'
  },
  {
      id: 175,
      place: 'Thailand'
  },
  {
      id: 176,
      place: 'Timor-Leste'
  },
  {
      id: 177,
      place: 'Togo'
  },
  {
      id: 178,
      place: 'Tonga'
  },
  {
      id: 179,
      place: 'Trinidad and Tobago'
  },
  {
      id: 180,
      place: 'Tunisia'
  },
  {
      id: 181,
      place: 'Turkey'
  },
  {
      id: 182,
      place: 'Turkmenistan'
  },
  {
      id: 183,
      place: 'Tuvalu'
  },
  {
      id: 184,
      place: 'Uganda'
  },
  {
      id: 185,
      place: 'Ukraine'
  },
  {
      id: 186,
      place: 'United Arab Emirates'
  },
  {
      id: 187,
      place: 'United Kingdom'
  },
  {
      id: 188,
      place: 'United States'
  },
  {
      id: 189,
      place: 'Uruguay'
  },
  {
      id: 190,
      place: 'Uzbekistan'
  },
  {
      id: 191,
      place: 'Vanuatu'
  },
  {
      id: 192,
      place: 'Vatican City'
  },
  {
      id: 193,
      place: 'Venezuela'
  },
  {
      id: 194,
      place: 'Vietnam'
  },
  {
      id: 195,
      place: 'Yemen'
  },
  {
      id: 196,
      place: 'Zambia'
  },
  {
      id: 197,
      place: 'Zimbabwe'
  },
  {
    id:198,
    place:'No Preference'
  }
  ]);
};
