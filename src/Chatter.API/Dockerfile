FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
# Tüm .csproj dosyalarını katmanlarına göre kopyala
COPY ["src/Chatter.API/Chatter.API.csproj", "src/Chatter.API/"]
COPY ["src/Chatter.Application/Chatter.Application.csproj", "src/Chatter.Application/"]
COPY ["src/Chatter.Infrastructure/Chatter.Infrastructure.csproj", "src/Chatter.Infrastructure/"]
COPY ["src/Chatter.Domain/Chatter.Domain.csproj", "src/Chatter.Domain/"]
RUN dotnet restore "src/Chatter.API/Chatter.API.csproj"

# Kalan her şeyi kopyala ve build al
COPY . .
WORKDIR "/src/src/Chatter.API"
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
# Statik dosyalar için wwwroot klasörü oluştur
RUN mkdir -p wwwroot/uploads

# Render'ın PORT değişkenini dinle
ENV ASPNETCORE_URLS=http://0.0.0.0:$PORT

# Container başlangıcı
ENTRYPOINT ["dotnet", "Chatter.API.dll"]