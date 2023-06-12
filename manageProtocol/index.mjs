export const handler = async(event) => {
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Olle from Lambda!'),
    };
    return response;
};
