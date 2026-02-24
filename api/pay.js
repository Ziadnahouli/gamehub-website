/**
 * GameHub Pro - Payment Initiation Bridge
 * This serverless function bypasses desktop app security blocks by initiating
 * payments from a secure, registered website domain.
 */

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, plan, ext_id } = req.query;

    if (!email || !plan || !ext_id) {
        return res.status(400).json({ error: 'Missing required parameters: email, plan, or ext_id' });
    }

    // Map plans to USD amounts
    const planPrices = {
        '1mo': 3.0,
        '6mo': 15.0,
        '12mo': 30.0
    };

    const amount = planPrices[plan];
    if (!amount) {
        return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Whish API Configuration (Must be set in hosting environment variables)
    const WHISH_CHANNEL = process.env.WHISH_CHANNEL;
    const WHISH_SECRET = process.env.WHISH_SECRET;

    if (!WHISH_CHANNEL || !WHISH_SECRET) {
        console.error("CRITICAL: WHISH_CHANNEL or WHISH_SECRET not set in environment.");
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const initiationUrl = 'https://api.whish.money/itel-service/api/payment/whish';

    try {
        const response = await fetch(initiationUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'channel': WHISH_CHANNEL,
                'secret': WHISH_SECRET,
                'websiteUrl': 'gamehub-launcher.xyz',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                amount: amount,
                currency: "USD",
                invoice: `GameHub Pro - ${plan} (${email})`,
                externalId: parseInt(ext_id),
                successCallbackUrl: `https://gamehub-launcher.xyz/api/payment/success?email=${encodeURIComponent(email)}&ext_id=${ext_id}&plan=${plan}`,
                failureCallbackUrl: `https://gamehub-launcher.xyz/api/payment/failure`,
                successRedirectUrl: `https://gamehub-launcher.xyz/api/payment/success?email=${encodeURIComponent(email)}&ext_id=${ext_id}&plan=${plan}`,
                failureRedirectUrl: `https://gamehub-launcher.xyz/api/payment/failure`
            })
        });

        const data = await response.json();

        // Check for success status (either boolean true or string 'success')
        if (data.status === true || data.status === 'success') {
            const collectUrl = data.data?.collectUrl || data.collectUrl;
            if (collectUrl) {
                return res.redirect(302, collectUrl);
            }
        }

        console.error("Whish Initiation Failed:", data);
        return res.status(500).json({
            error: 'Whish Initiation Failed',
            details: data.message || data.error || 'Unknown error'
        });

    } catch (error) {
        console.error("Payment Bridge Error:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
