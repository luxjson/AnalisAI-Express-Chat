function formatarDataHora(data) {
    if (!data) return '---';
    return new Date(data).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
}

function formatarData(data) {
    if (!data) return '---';
    return new Date(data).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

module.exports = { formatarDataHora, formatarData };