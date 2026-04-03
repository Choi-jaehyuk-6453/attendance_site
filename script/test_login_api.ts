async function testLogin() {
    console.log("Testing worker login for 장치홍, pw: 7887");
    try {
        const res = await fetch("http://localhost:5000/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: "장치홍",
                password: "7887"
            })
        });

        const text = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`Response: ${text}`);
    } catch (e) {
        console.error(e);
    }
}

testLogin();
